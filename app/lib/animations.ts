import type {Transition} from "framer-motion";


export const contentTransition: Transition = {
    duration: 0.25,
    ease: "easeInOut",
};

export const contentMotion = {
    initial: {opacity: 0, y: 8},
    animate: {opacity: 1, y: 0},
    exit: {opacity: 0, y: -8},
    transition: contentTransition,
};

export const backdropMotion = {
    initial: {opacity: 0},
    animate: {opacity: 1},
    exit: {opacity: 0},
    transition: contentTransition,
};
