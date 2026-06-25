/**
 * Server-side helper to send push notifications.
 * Call from API routes — never from client code.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://littleloop-creche-v1.vercel.app";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

interface NotifyOptions {
  targetUids: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function notifyUsers(opts: NotifyOptions): Promise<void> {
  if (!opts.targetUids.length) return;
  try {
    await fetch(`${APP_URL}/api/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify(opts),
    });
  } catch (err) {
    // Non-fatal — notification failure should never break the main action
    console.warn("notify failed:", err);
  }
}

/** Notify all parents of a child that their daily update is ready. */
export async function notifyParentsOfUpdate(
  parentIds: string[],
  childFirstName: string
): Promise<void> {
  await notifyUsers({
    targetUids: parentIds,
    title: `${childFirstName}'s day has started 🌟`,
    body: "Your daily update is ready — tap to see how they're doing.",
    url: "/parent",
    tag: `update-${childFirstName}`,
  });
}

/** Notify parents that a new photo moment was shared. */
export async function notifyParentsOfMoment(
  parentIds: string[],
  childFirstName: string
): Promise<void> {
  await notifyUsers({
    targetUids: parentIds,
    title: `A new moment from ${childFirstName}'s day 📸`,
    body: "Tap to see the photo.",
    url: "/parent",
    tag: `moment-${childFirstName}`,
  });
}

/** Notify a parent about an outstanding invoice. */
export async function notifyParentOfInvoice(
  parentId: string,
  schoolName: string,
  amountFormatted: string
): Promise<void> {
  await notifyUsers({
    targetUids: [parentId],
    title: `Fee reminder from ${schoolName}`,
    body: `${amountFormatted} is due. Tap to view and upload proof of payment.`,
    url: "/parent",
    tag: "invoice-reminder",
  });
}
