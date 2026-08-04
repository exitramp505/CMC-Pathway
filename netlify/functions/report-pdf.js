const { buildPdfBuffer, safeFileName } = require('./pdf-generator');
const { requireUser } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok:false, error:'Method not allowed' }) };
  }
  try {
    await requireUser(event);
    const data = JSON.parse(event.body || '{}');
    if (!data.candidate || !data.scores) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok:false, error:'Missing report data.' }) };
    }
    const pdf = await buildPdfBuffer(data, { leaderEmail: data.routedLeader || '' });
    const filename = `${safeFileName(data.candidate.name)}-discernment-report.pdf`;
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      },
      isBase64Encoded: true,
      body: pdf.toString('base64')
    };
  } catch (error) {
    return { statusCode: error.statusCode || 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok:false, error:error.message || 'Could not generate PDF.' }) };
  }
};
