/**
 * Global bot-pause flag — module-level singleton so interpreter.js,
 * Purchase.js and any other engine file can cheaply read/write pause state
 * without importing the MobX store (which would cause a circular dep).
 *
 * The flag is set by dbot.js pauseBot/resumeBot, which already calls
 * interpreter.pause/resume.  Having this flat flag lets Purchase.js gate
 * side-fire purchases without touching the interpreter directly.
 */

let _paused = false;

export const setBotPaused = (v: boolean): void => { _paused = v; };
export const isBotPaused  = (): boolean          => _paused;
