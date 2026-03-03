export const errorHandler = (err, req, res, next) => {
  console.error("[Error]", err);
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message || "Error interno del servidor";
  res.status(status).json({
    error: message,
    code: err.code || (status >= 500 ? "INTERNAL_ERROR" : undefined),
  });
};
