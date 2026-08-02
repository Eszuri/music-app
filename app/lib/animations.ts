import type {Transition} from "framer-motion";


export const contentTransition: Transition = {
    duration: 0.25,
    ease: "easeInOut",
};

/** General content fade+slide animation (non-modal elements). */
export const contentMotion = {
    initial: {opacity: 0, y: 8},
    animate: {opacity: 1, y: 0},
    exit: {opacity: 0, y: -8},
    transition: contentTransition,
};

/** Shared modal backdrop fade animation. */
export const backdropMotion = {
    initial: {opacity: 0},
    animate: {opacity: 1},
    exit: {opacity: 0},
    transition: {duration: 0.2, ease: "easeInOut" as const},
};

/** Shared modal content scale+slide animation. */
export const modalContentMotion = {
    initial: {opacity: 0},
    animate: {opacity: 1},
    exit: {opacity: 0},
    transition: {duration: 0.25} as Transition,
};
