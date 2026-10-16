/**
 * Framer Motion feature bundle, loaded lazily by <LazyMotion>. `domMax` (not
 * `domAnimation`) because swipe-to-reply, the photo viewer and the reorderable
 * lists need drag; it still ships only once and off the critical path.
 */
import { domMax } from "framer-motion";

export default domMax;
