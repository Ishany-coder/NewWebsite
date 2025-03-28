import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { generateSQL } from './getSQLData';
import { runSQL } from './runSQL';
import { env } from '$env/dynamic/private';

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY ?? '',
});

function errorHandler(error: unknown) {
  if (error == null) {
    return 'unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return JSON.stringify(error);
}

async function getTeamData(messages: { content: string; role: string }[]) {
  console.log('CALLING generateDQWL');
    const queryResponse = await generateSQL(messages);
    const queryData = await queryResponse.json();
    const sqlQuery = queryData.newSqlQuery;
    const dbResponse = await runSQL(sqlQuery);
    const dbData = await dbResponse.json();
    return { sqlQuery, dbData };
}


export const POST = (async ({ request }) => {
  const { messages } = await request.json();
  try {
  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    tools: {
      teamScout: tool({
        description: 'This tool gets information about teams like team performance, match data, their scores and which teams are doing well and which are not doing well. It is used to find teams based on their performance',
        parameters: z.object({
        }),
        execute: async ({ }) => {
          console.log(messages);
          const {sqlQuery, dbData} = await getTeamData(messages);
          console.log('------ Calling the teamScout tool -------');
         console.log(sqlQuery);
          return {
              sqlQuery,
              dbData
          };
        },
      }),
    },
  });
  return result.toDataStreamResponse({
    getErrorMessage: errorHandler,
  });

} catch(err) {
  console.log(err);
  return new Response(JSON.stringify({ error: 'An error occurred' }), {
    status: 500
  });
}

}) satisfies RequestHandler;