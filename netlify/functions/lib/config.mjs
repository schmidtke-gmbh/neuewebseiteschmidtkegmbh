export const config = {
  pipelineId: process.env.SALESSUITE_PIPELINE_ID || 'cmls2koll004vbq0146qpc8xr',
  phases: {
    inquiry: process.env.SALESSUITE_STAGE_INQUIRY_ID || 'cmls2kols004wbq01s53izeij',
    firstCall: process.env.SALESSUITE_STAGE_FIRST_CALL_ID || 'cmmap9d1g01h9b601m57wpzpl',
    followup: process.env.SALESSUITE_STAGE_FOLLOWUP_ID || 'cmls2kols004xbq01pkbyjhjh',
    qualified: process.env.SALESSUITE_STAGE_QUALIFIED_ID || 'cmls2kols004ybq01h54xzrfz',
    strategy: process.env.SALESSUITE_STAGE_STRATEGY_ID || 'cmls2kols004zbq01sylneh1w',
    sold: process.env.SALESSUITE_STAGE_SOLD_ID || 'cmls2kols0051bq01r03od2s8',
    lost: process.env.SALESSUITE_STAGE_LOST_ID || 'cmls2kols0052bq01hv95qb9y',
    unqualified: process.env.SALESSUITE_STAGE_UNQUALIFIED_ID || 'cmls2kols0053bq0163lgg2hh',
  },
  websiteEventTypeId: Number(process.env.CAL_WEBSITE_EVENT_TYPE_ID || 7242881),
};

export function assertRuntimeConfig() {
  const required = ['SALESSUITE_API_KEY', 'SLACK_WEBHOOK_URL', 'CAL_WEBHOOK_SECRET'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing runtime configuration: ${missing.join(', ')}`);
}
