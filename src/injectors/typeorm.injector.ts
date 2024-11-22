import { Injectable, Logger, Inject } from '@nestjs/common';
import { BaseInjector } from './base.injector';
import { AttributeNames, SDK_CONFIG } from '../constants';
import { ModulesContainer } from '@nestjs/core';
import { SpanKind } from '@opentelemetry/api';
import { SemanticAttributes, DbSystemValues } from '@opentelemetry/semantic-conventions';
import { trace, context } from '@opentelemetry/api';
import { Span } from '@opentelemetry/sdk-trace-base';
import * as fg from 'fast-glob';

const DB_STATEMENT_PARAMETERS = 'db.statement.parameters';

const sqliteFamily = [
  'sqlite',
  'cordova',
  'react-native',
  'nativescript',
  'expo',
  'better-sqlite3',
  'capacitor',
  'sqljs',
];

const auroraFamily = ['aurora-mysql', 'aurora-postgres'];

function getDefaultPort(type: string): number | undefined {
  switch (type) {
    case 'mysql': return 3306;
    case 'postgres': return 5432;
    case 'cockroachdb': return 26257;
    case 'sap': return 39015;
    case 'mariadb': return 3306;
    case 'oracle': return 1521;
    case 'mssql': return 1433;
    case 'mongodb': return 27017;
    default: return undefined;
  }
}

function getDbSystemValue(options: any): string {
  switch (options.type) {
    case 'mysql':
    case 'aurora-mysql': return DbSystemValues.MYSQL;
    case 'postgres':
    case 'aurora-postgres': return DbSystemValues.POSTGRESQL;
    case 'cockroachdb': return DbSystemValues.COCKROACHDB;
    case 'sap': return DbSystemValues.HANADB;
    case 'mariadb': return DbSystemValues.MARIADB;
    case 'oracle': return DbSystemValues.ORACLE;
    case 'mssql': return DbSystemValues.MSSQL;
    case 'mongodb': return DbSystemValues.MONGODB;
    case 'sqlite':
    case 'cordova':
    case 'react-native':
    case 'nativescript':
    case 'expo':
    case 'better-sqlite3':
    case 'capacitor':
    case 'sqljs': return DbSystemValues.SQLITE;
    default: return DbSystemValues.OTHER_SQL;
  }
}

@Injectable()
export class TypeormInjector extends BaseInjector {
  private readonly logger = new Logger(TypeormInjector.name);
  private readonly config: Record<string, any>;
  private readonly attributeCache = new Map<any, Record<string, any>>();

  constructor(
    modulesContainer: ModulesContainer,
    @Inject(SDK_CONFIG) config: Record<string, any>
  ) {
    super(modulesContainer);
    this.config = config.injectorsConfig?.[TypeormInjector.name] ?? {};
  }

  inject(): void {
    this.injectQueryRunner();
    this.injectEntityManager();
  }

  private getConnectionAttributes(options: any): Record<string, any> {
    if (sqliteFamily.includes(options.type)) {
      return {
        [SemanticAttributes.DB_SYSTEM]: DbSystemValues.SQLITE,
        [SemanticAttributes.DB_CONNECTION_STRING]: typeof options.database === 'string'
          ? options.database
          : DbSystemValues.CACHE,
      };
    }

    if (!sqliteFamily.concat(auroraFamily).includes(options.type)) {
      const connectionOptions = options;
      let host = connectionOptions.host || 'localhost';
      let port = connectionOptions.port || getDefaultPort(options.type);
      let user = connectionOptions.username;
      let database = typeof options.database === 'string' ? options.database : undefined;

      if (connectionOptions.url) {
        const url = new URL(connectionOptions.url);
        port = Number(url.port) || port;
        host = url.hostname;
        user = url.username;
        database = url.pathname.slice(1) || database;
      }

      return {
        [SemanticAttributes.DB_SYSTEM]: getDbSystemValue(options),
        [SemanticAttributes.DB_CONNECTION_STRING]: `${options.type}://${user ? `${user}@` : ''}${host}:${port}${database ? `/${database}` : ''}`,
        [SemanticAttributes.NET_PEER_NAME]: host,
        [SemanticAttributes.NET_PEER_PORT]: port,
        [SemanticAttributes.DB_USER]: user,
        [SemanticAttributes.DB_NAME]: database,
      };
    }

    return {
      [SemanticAttributes.DB_SYSTEM]: getDbSystemValue(options),
      [SemanticAttributes.DB_NAME]: typeof options.database === 'string' ? options.database : undefined,
    };
  }

  private getSemanticAttributes(dataSource: any): Record<string, any> {
    if (!this.attributeCache.has(dataSource)) {
      const options = dataSource.options;
      const attributes = this.getConnectionAttributes(options);
      this.attributeCache.set(dataSource, attributes);
    }
    return this.attributeCache.get(dataSource)!;
  }

  private injectQueryRunner(): void {
    fg.sync('typeorm/driver/*/*.js', { cwd: 'node_modules' })
      .filter(f => f.includes('QueryRunner'))
      .forEach(filePath => {
        try {
          const moduleExports = require(filePath);
          const [, queryRunner] = Object.entries(moduleExports)
            .find(([name, type]) =>
              name.includes('QueryRunner') && typeof type === 'function'
            ) ?? [];

          if (!queryRunner) return;

          const prototype = (queryRunner as any).prototype;
          if (prototype.query === undefined) return;

          prototype.query = this.wrap(
            prototype.query,
            'TypeORM -> raw query',
            {
              kind: SpanKind.CLIENT,
            },
            true,
            ({ args, thisArg, parentSpan }) => {
              const runner = thisArg;
              const parentAttributes = parentSpan instanceof Span ? parentSpan.attributes : {};
              const statement = args[0];
              const operation = statement.trim().split(' ')[0].toUpperCase();
              const span = trace.getSpan(context.active());
              span?.updateName(`TypeORM -> ${operation}`);

              const attributes: Record<string, any> = {
                [SemanticAttributes.DB_STATEMENT]: args[0],
                [SemanticAttributes.DB_NAME]: parentAttributes[SemanticAttributes.DB_NAME],
                [SemanticAttributes.DB_SQL_TABLE]: parentAttributes[SemanticAttributes.DB_SQL_TABLE],
                [SemanticAttributes.DB_OPERATION]: operation,
                ...this.getSemanticAttributes(runner.connection),
              };

              if (this.config.collectParameters) {
                try {
                  attributes[DB_STATEMENT_PARAMETERS] = JSON.stringify(args[1]);
                } catch (e) {
                  // Ignore serialization errors
                }
              }

              return attributes;
            }
          );

          this.logger.log(`Mapped ${(queryRunner as any).name}`);
        } catch (e) {
          this.logger.warn(`Failed to inject query runner: ${e}`);
        }
      });
  }

  private injectEntityManager(): void {
    try {
      const EntityManager = require('typeorm').EntityManager;
      if (!EntityManager) return;

      const prototype = EntityManager.prototype;
      const usingEntityPersistExecutor = ['save', 'remove', 'softRemove', 'recover'];
      const usingQueryBuilder = [
        'insert', 'update', 'delete', 'softDelete', 'restore',
        'count', 'find', 'findAndCount', 'findByIds', 'findOne',
        'increment', 'decrement'
      ];

      [...usingEntityPersistExecutor, ...usingQueryBuilder].forEach(key => {
        if (!this.isAffected(prototype[key])) {
          const name = `TypeORM -> EntityManager -> ${key}`;
          prototype[key] = this.wrap(
            prototype[key],
            name,
            {},
            true,
            ({ args, thisArg }) => {
              const entityManager = thisArg;
              let metadata;

              if (usingEntityPersistExecutor.includes(key)) {
                const entityOrTarget = args[0];
                let target;

                if (Array.isArray(entityOrTarget)) {
                  target = entityOrTarget[0].constructor;
                } else if (typeof entityOrTarget === 'function' ||
                         entityOrTarget['@instanceof'] === Symbol.for('EntitySchema')) {
                  target = entityOrTarget;
                } else {
                  target = typeof entityOrTarget === 'string'
                    ? entityOrTarget
                    : entityOrTarget.constructor;
                }

                metadata = entityManager.connection.getMetadata(target);
              } else {
                metadata = entityManager.connection.getMetadata(args[0]);
              }

              return {
                [SemanticAttributes.DB_NAME]: metadata.schema ?? metadata.database,
                [SemanticAttributes.DB_SQL_TABLE]: metadata.tableName,
                ...this.getSemanticAttributes(entityManager.connection),
              };
            }
          );

          this.logger.log(`Mapped ${name}`);
        }
      });
    } catch (e) {
      this.logger.warn('typeorm is not installed, TypeormInjector will be disabled.');
    }
  }
}
