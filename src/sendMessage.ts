/* import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import Twilio from "twilio";
import dotenv from "dotenv";
import { queryDeepSeek } from "./promptDeepSeek";

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = Twilio(accountSid, authToken);

export async function sendWhatsAppMessage(fastify: FastifyInstance) {
  fastify.post(
    "/send-message",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { to, message } = request.body as { to: string; message: string };

        if (!to || !message) {
          return reply
            .status(400)
            .send({ error: "Missing 'to' or 'message' parameter" });
        }

        const answer = await queryDeepSeek("What is the Capital of Brazil");
        // return reply.send({ status: "Message sent", answer });

        const response = await client.messages.create({
          from: fromNumber, // Your Twilio WhatsApp number
          to: `whatsapp:${to}`, // Recipient's WhatsApp number
          body: message,
        });

        return reply.send({
          status: "Message sent",
          sid: response.sid,
          answer,
        });
      } catch (error) {
        console.error("Twilio Error:", error);
        return reply.status(500).send({ error: "Failed to send message" });
      }
    }
  );
}
 */
