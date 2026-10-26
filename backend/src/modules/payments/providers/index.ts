import { PaymentProvider } from "@prisma/client";
import { PaymentGateway } from "./payment-gateway.interface";
import { PagarGateway } from "./pagar.provider";
import { PaySuiteGateway } from "./paysuite.provider";
import { PayPalGateway } from "./paypal.provider";

const mpesaGateway = new PaySuiteGateway("mpesa");
const emolaGateway = new PaySuiteGateway("emola");
const cardGateway = new PaySuiteGateway("credit_card");
const paypalGateway = new PayPalGateway();
const pagarMpesaGateway = new PagarGateway("MPESA");
const pagarEmolaGateway = new PagarGateway("EMOLA");

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
    case PaymentProvider.PAGAR_MPESA:
      return pagarMpesaGateway;
    case PaymentProvider.PAGAR_EMOLA:
      return pagarEmolaGateway;
  }
}

/** Exposed separately — `captureOrder` isn't part of the generic PaymentGateway interface. */
export { paypalGateway };
