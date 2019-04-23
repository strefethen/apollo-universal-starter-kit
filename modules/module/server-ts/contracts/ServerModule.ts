import { Express } from 'express';
import GraphQLServerModule, { GraphQLServerModuleShape } from './GraphQLServerModule';

/**
 * A function which registers new middleware.
 *
 * @param app an instance of Express
 * @param appContext application context
 */
export type MiddlewareFunc = (app: Express, appContext: { [key: string]: any }) => void;

/**
 * Server feature modules interface
 */
export interface ServerModuleShape extends GraphQLServerModuleShape {
  // A list of functions to register high-priority middlewares (happens before registering normal priority ones)
  beforeware?: MiddlewareFunc[];
  // A list of functions to register normal-priority middlewares
  middleware?: MiddlewareFunc[];
}

interface ServerModule extends ServerModuleShape {}

/**
 * A class that represents server-side feature module
 *
 * An instance of this class is exported by each Node backend feature module
 */
class ServerModule extends GraphQLServerModule {
  /**
   * Constructs backend Node feature module representation, that folds all the feature modules
   * into a single module represented by this instance.
   *
   * @param modules feature modules
   */
  constructor(...modules: ServerModuleShape[]) {
    super(...modules);
  }
}

export default ServerModule;
