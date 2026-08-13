import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyDriverProfile } from '../../../api/drivers.api';
import { useSocketEvent } from '../../../hooks/useSocketEvent';
import type { JobPayload } from '../../../socket/SocketService';

// job:new-request is broadcast to EVERY socket in the company fleet room —
// it is NOT pre-filtered to only the offered drivers (verified directly
// against job.socket.ts / SOCKET-CONTRACT.md during the Phase 3 preflight).
// This hook is the one place that applies the real filter: only treat it as
// "an offer for me" if my own driver _id is in the payload's
// offeredDriverIds. A driver cannot GET /jobs/:id or job:subscribe for a job
// before accepting it (assertJobAccess requires job.driverId, which is unset
// until accept) — so the offer's full detail comes from this socket payload
// alone, never re-fetched.
//
// QA audit finding #4 — the launch-time race: SocketService.connect() fires
// in AuthContext the moment auth succeeds, well before this hook can know
// its own driver _id. DriverNavigator.tsx now mounts this hook's consumer
// (DriverOfferOverlay) unconditionally, outside every profileStatus branch,
// closing almost the entire window — but "almost" isn't "never": a genuine
// job:new-request can still arrive in the brief gap between this hook
// mounting and the driver-profile query resolving. That is a real
// client-side race (the event genuinely reached the socket, a listener
// genuinely was registered, but the ID check couldn't be evaluated yet) —
// worth buffering and re-checking once the ID resolves, unlike an event
// that never reached the socket at all (disconnected, or broadcast before
// this session's socket even connected), which no amount of client-side
// buffering can honestly recover — nothing was ever delivered to buffer.
//
// Uses useQuery (same ['drivers','me'] key useProfileStatus's own driver
// query already uses) rather than a one-off imperative fetch — this shares
// the same cache entry (no duplicate request against a warm cache) while
// staying reactively subscribed, so a fetch that's still in flight when this
// hook mounts is correctly picked up the moment it resolves, not just
// checked once on mount.
export function useIncomingJobOffer() {
  const [offer, setOffer] = useState<JobPayload | null>(null);
  const myDriverIdRef = useRef<string | null>(null);
  // Offers whose "is this for me" check couldn't be evaluated yet because
  // myDriverIdRef wasn't populated at the time — re-evaluated the moment it
  // resolves. Capped defensively; realistically holds at most one entry.
  const pendingOffersRef = useRef<JobPayload[]>([]);
  // Once a job has been surfaced as an offer, never surface it again for the
  // rest of this session — protects against a duplicate/retried
  // job:new-request re-opening a modal for a job already accepted/rejected/
  // dismissed. Naturally reset on logout, since DriverNavigator (and this
  // hook with it) unmounts when RootNavigator swaps back to AuthNavigator.
  const seenJobIdsRef = useRef<Set<string>>(new Set());

  const driverQuery = useQuery({
    queryKey: ['drivers', 'me'],
    queryFn: getMyDriverProfile,
  });

  const considerOffer = useCallback((job: JobPayload) => {
    const myId = myDriverIdRef.current;

    if (!myId) {
      // Don't know our own ID yet — buffer rather than silently drop; the
      // effect below re-checks this the moment the ID resolves. Cap to a
      // small bound so a pathological burst can't grow this unbounded.
      pendingOffersRef.current = [...pendingOffersRef.current.filter((j) => j._id !== job._id), job].slice(-5);
      return;
    }

    const offeredDriverIds = (job.offeredDriverIds as string[] | undefined) ?? [];
    if (!offeredDriverIds.includes(myId)) {
      return; // Not offered to this driver — ignore, per the note above.
    }

    if (job._id) {
      if (seenJobIdsRef.current.has(job._id)) return;
      seenJobIdsRef.current.add(job._id);
    }

    setOffer(job);
  }, []);

  useEffect(() => {
    if (!driverQuery.data) return;

    myDriverIdRef.current = driverQuery.data._id;

    const pending = pendingOffersRef.current;
    pendingOffersRef.current = [];
    pending.forEach(considerOffer);
  }, [driverQuery.data, considerOffer]);

  useSocketEvent('job:new-request', considerOffer);

  const dismiss = useCallback(() => setOffer(null), []);

  return { offer, dismiss };
}
