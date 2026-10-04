import { mailer } from "../integrations/mailer";
import {
  enrollmentEmail,
  instructorRequestEmail,
  passwordResetEmail,
  paymentReceiptEmail,
  welcomeEmail,
} from "./templates";

/**
 * Every function here is fire-and-forget: it returns void, not a promise, and
 * swallows whatever goes wrong inside.
 *
 * The reason is the same in each case — the thing being announced has already
 * happened and been committed. A registration is complete, a payment has
 * cleared, a course is unlocked. Making the caller await an SMTP round trip
 * would put a mail server on the critical path of a checkout, and letting a
 * rejection escape would turn a successful payment into a 500 while the money
 * stays taken. The user hears about it or they do not; the outcome is the
 * same either way.
 */
function dispatch(promise: Promise<unknown>): void {
  promise.catch((error) => {
    // mailer.send already swallows delivery failures; this catches anything
    // thrown while building the message itself.
    // eslint-disable-next-line no-console
    console.error("Notification failed:", error);
  });
}

export const notifications = {
  userRegistered(user: { name: string; email: string }): void {
    dispatch(mailer.send({ to: user.email, ...welcomeEmail(user.name) }));
  },

  /**
   * Tells the admins that someone wants to teach. One mail per admin rather
   * than one with everyone in `to`, so no admin learns the others' addresses.
   *
   * Fire-and-forget like the rest, and here that is only acceptable because
   * the request is also written to the audit log: if the mail never arrives,
   * the record of the request still exists somewhere an admin can read.
   */
  instructorRequested(
    admins: { email: string }[],
    applicant: { name: string; email: string },
    message: string
  ): void {
    const rendered = instructorRequestEmail(applicant, message);
    for (const admin of admins) {
      dispatch(mailer.send({ to: admin.email, ...rendered }));
    }
  },

  /**
   * Unlike the others this is not a courtesy: without the email the user
   * cannot finish the reset. It still cannot be awaited by the caller,
   * because doing so would make the endpoint's response time reveal whether
   * the address exists.
   */
  passwordReset(user: { name: string; email: string }, rawToken: string): void {
    dispatch(mailer.send({ to: user.email, ...passwordResetEmail(user.name, rawToken) }));
  },

  enrolled(user: { name: string; email: string }, course: { title: string; slug: string }): void {
    dispatch(mailer.send({ to: user.email, ...enrollmentEmail(user.name, course.title, course.slug) }));
  },

  /** One receipt for the charge, listing every course it covered. */
  paymentCompleted(
    user: { name: string; email: string },
    courses: { title: string; slug: string }[],
    payment: { amountCents: number; currency: string }
  ): void {
    dispatch(
      mailer.send({
        to: user.email,
        ...paymentReceiptEmail(user.name, courses, payment.amountCents, payment.currency),
      })
    );
  },
};
