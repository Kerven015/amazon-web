import type { OrderStatus, TrackingEvent } from "../types";

/**
 * The tracking timeline (placed → delivered). Texts are keys the UI translates
 * (messages → orders.status.*). Cancelled orders show the steps they reached.
 */
export const trackingSteps: { status: OrderStatus }[] = [
  { status: "placed" },
  { status: "packed" },
  { status: "shipped" },
  { status: "out_for_delivery" },
  { status: "delivered" },
];

export function buildTracking(
  status: OrderStatus,
  dates: Partial<Record<OrderStatus, string>>,
  locations: Partial<Record<OrderStatus, string>> = {},
): TrackingEvent[] {
  const reached = trackingSteps.findIndex((s) => s.status === status);
  return trackingSteps.map((step, i) => ({
    status: step.status,
    label: step.status,
    date: dates[step.status],
    location: locations[step.status],
    // Cancelled: every step that has a date was reached
    done: reached >= 0 ? i <= reached : !!dates[step.status],
  }));
}
