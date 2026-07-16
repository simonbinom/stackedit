exports.getBearerToken = (req) => {
  const authorization = req.get('Authorization') || '';
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  return bearerMatch && bearerMatch[1];
};
