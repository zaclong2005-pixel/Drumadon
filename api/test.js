export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  console.log('TEST ENDPOINT - Request received');
  console.log('Method:', req.method);
  console.log('Body:', typeof req.body);

  res.status(200).json({
    status: 'working',
    message: 'API endpoint is responding',
    method: req.method,
    timestamp: new Date().toISOString()
  });
}
