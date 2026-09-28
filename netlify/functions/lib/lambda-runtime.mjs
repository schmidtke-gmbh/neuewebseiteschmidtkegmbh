export function buildLambdaEntrypoint({ connect, createHandler }) {
  return async (event, context) => {
    connect(event);
    const handler = createHandler();
    return handler(event, context);
  };
}
