import { PaymentProvider } from "@prisma/client";
import { PaymentGateway } from "./payment-gateway.interface";
import { PaySuiteGateway } from "./paysuite.provider";
import { PayPalGateway } from "./paypal.provider";

const mpesaGateway = new PaySuiteGateway("mpesa");
const emolaGateway = new PaySuiteGateway("emola");
const cardGateway = new PaySuiteGateway("credit_card");
const paypalGateway = new PayPalGateway();

export function getPaymentGateway(provider: PaymentProvider): PaymentGateway {
  switch (provider) {
    case PaymentProvider.MPESA:
      return mpesaGateway;
    case PaymentProvider.EMOLA:
      return emolaGateway;
    case PaymentProvider.CARD:
      return cardGateway;
    case PaymentProvider.PAYPAL:
      return paypalGateway;
  }
}

/** Exposed separately — `captureOrder` isn't part of the generic PaymentGateway interface. */
export { paypalGateway };
