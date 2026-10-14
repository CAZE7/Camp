import { runRoutingJob, type RoutingJob, type RoutingJobReply } from './routingJob';

self.onmessage = (event: MessageEvent<RoutingJob>) => {
  let reply: RoutingJobReply;
  try {
    reply = { result: runRoutingJob(event.data) };
  } catch (error) {
    reply = { error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
