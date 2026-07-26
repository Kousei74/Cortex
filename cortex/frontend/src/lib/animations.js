// Standard transition settings for the "Illusionist" feel
export const SPRING_TRANSITION = {
    type: "spring",
    stiffness: 400,
    damping: 30,
};

export const SLOW_SPRING = {
    type: "spring",
    stiffness: 300,
    damping: 30,
};

export const PAGE_TRANSITION = {
    initial: { opacity: 0, y: 10, filter: "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -10, filter: "blur(8px)" },
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }, // custom bezier for smooth "apple-like" easing
};

export const FADE_IN = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
};

export const STAGGER_CHILDREN = {
    animate: {
        transition: {
            staggerChildren: 0.05,
        },
    },
};

export const SCALE_ON_TAP = {
    whileTap: { scale: 0.98 },
    whileHover: { scale: 1.02 },
};
