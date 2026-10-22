/**
 * Host half of dsh-session-overview.
 *
 * Phase 1 is read-only: this package contributes browser presentation only, so
 * the node-side body stays empty. The browser half ships through the
 * `./client` export and is loaded by the client module loader.
 */

/** Host plugin body — nothing to do on the host. */
export function apply() {}
