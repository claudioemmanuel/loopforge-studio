// Helpers
export {
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
  getAIClientConfig,
  createUserAIClient,
  type AIClientConfig,
} from "./helpers";

// Middleware
export {
  withAuth,
  withTask,
  type AuthContext,
  type TaskContext,
} from "./middleware";

// Cached queries (React cache for request deduplication)
export {
  getUser,
  getUserWithSubscription,
  getRepos,
  getRepo,
  getTask,
  getTasksByRepo,
} from "./cached-queries";
