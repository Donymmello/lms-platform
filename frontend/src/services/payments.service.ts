import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import { CheckoutResult, MyPayment, PaymentProvider } from "@/types/payment";

export const paymentsService = {
  /**
   * One charge for one course or a cartful. The server refuses a part-invalid
   * cart whole, so there is no partial success to handle here.
   */
  async checkout(courseIds: string[], provider: PaymentProvider): Promise<CheckoutResult> {
    const res = await apiFetch<ApiSuccessResponse<{ checkout: CheckoutResult }>>("/payments/checkout", {
      method: "POST",
      body: { courseIds, provider },
    });
    return res.data.checkout;
  },

  async capturePaypal(reference: string): Promise<CheckoutResult> {
    const res = await apiFetch<ApiSuccessResponse<{ checkout: CheckoutResult }>>("/payments/paypal/capture", {
      method: "POST",
      body: { reference },
    });
    return res.data.checkout;
  },

  async listMine(): Promise<MyPayment[]> {
    const res = await apiFetch<ApiSuccessResponse<{ payments: MyPayment[] }>>("/payments/me");
    return res.data.payments;
  },
};
