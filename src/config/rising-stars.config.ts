/**
 * Rising Stars Configuration
 * 
 * Centralized configuration for the Rising Stars ranking algorithm.
 * This allows easy tuning of weights, time windows, and formulas without code changes.
 * 
 * @see src/controllers/user.controller.ts - discoverArtists() risingScore case
 */

export interface RisingStarsWeights {
  follower: number;
  like: number;
  comment: number;
  share: number;
}

export interface RisingStarsFormula {
  name: string;
  description: string;
  weights: RisingStarsWeights;
}

export interface RisingStarsConfig {
  timeWindows: {
    [key: string]: number; // milliseconds
  };
  defaultTimeWindow: string;
  maxTimeWindow: number; // Max allowed in days
  weights: RisingStarsWeights;
  formulas: {
    [key: string]: RisingStarsFormula;
  };
  defaultFormula: string;
}

/**
 * Rising Stars Algorithm Configuration
 */
export const RISING_STARS_CONFIG: RisingStarsConfig = {
  /**
   * Time Windows (in milliseconds)
   * Define how far back to look for engagement metrics
   */
  timeWindows: {
    '7d': 7 * 24 * 60 * 60 * 1000,      // 1 week - Hot/trending artists
    '30d': 30 * 24 * 60 * 60 * 1000,    // 1 month - Rising stars (default)
    '90d': 90 * 24 * 60 * 60 * 1000,    // 3 months - Long-term trending
  },

  /**
   * Default time window if not specified in query
   */
  defaultTimeWindow: '30d',

  /**
   * Maximum allowed time window (in days)
   * Prevents excessive database queries
   */
  maxTimeWindow: 90,

  /**
   * Default engagement weights
   * Higher weight = more influence on rising score
   */
  weights: {
    follower: 2.0,   // New followers show growth
    like: 1.5,       // Likes show content appreciation
    comment: 1.2,    // Comments show engagement depth
    share: 3.0,      // Shares show viral potential (highest weight)
  },

  /**
   * Pre-defined formulas for different ranking strategies
   * Can be selected via query parameter: ?formula=viral
   */
  formulas: {
    balanced: {
      name: 'Balanced',
      description: 'Default balanced ranking across all engagement types',
      weights: {
        follower: 2.0,
        like: 1.5,
        comment: 1.2,
        share: 3.0,
      },
    },
    viral: {
      name: 'Viral',
      description: 'Emphasizes shares and likes for viral content discovery',
      weights: {
        follower: 1.0,
        like: 2.0,
        comment: 1.0,
        share: 5.0, // Heavy emphasis on sharing
      },
    },
    engaged: {
      name: 'Engaged',
      description: 'Emphasizes comments and interaction depth',
      weights: {
        follower: 1.5,
        like: 1.5,
        comment: 4.0, // Heavy emphasis on discussion
        share: 2.0,
      },
    },
    growth: {
      name: 'Growth',
      description: 'Emphasizes follower growth and discovery',
      weights: {
        follower: 4.0, // Heavy emphasis on new followers
        like: 1.5,
        comment: 1.0,
        share: 2.0,
      },
    },
  },

  /**
   * Default formula if not specified in query
   */
  defaultFormula: 'balanced',
};

/**
 * Get time window in milliseconds from string key
 * @param windowKey - Time window key (e.g., '7d', '30d', '90d')
 * @returns Time window in milliseconds, or default if invalid
 */
export function getTimeWindow(windowKey?: string): number {
  if (!windowKey) {
    return RISING_STARS_CONFIG.timeWindows[RISING_STARS_CONFIG.defaultTimeWindow];
  }

  const window = RISING_STARS_CONFIG.timeWindows[windowKey];
  if (!window) {
    console.warn(`Invalid time window: ${windowKey}, using default: ${RISING_STARS_CONFIG.defaultTimeWindow}`);
    return RISING_STARS_CONFIG.timeWindows[RISING_STARS_CONFIG.defaultTimeWindow];
  }

  return window;
}

/**
 * Get formula weights
 * @param formulaKey - Formula key (e.g., 'balanced', 'viral', 'engaged')
 * @returns Formula weights, or default if invalid
 */
export function getFormulaWeights(formulaKey?: string): RisingStarsWeights {
  if (!formulaKey) {
    return RISING_STARS_CONFIG.weights;
  }

  const formula = RISING_STARS_CONFIG.formulas[formulaKey];
  if (!formula) {
    console.warn(`Invalid formula: ${formulaKey}, using default: ${RISING_STARS_CONFIG.defaultFormula}`);
    return RISING_STARS_CONFIG.weights;
  }

  return formula.weights;
}

/**
 * Get all available time windows (for API documentation)
 */
export function getAvailableTimeWindows(): string[] {
  return Object.keys(RISING_STARS_CONFIG.timeWindows);
}

/**
 * Get all available formulas (for API documentation)
 */
export function getAvailableFormulas(): Array<{ key: string; name: string; description: string }> {
  return Object.entries(RISING_STARS_CONFIG.formulas).map(([key, formula]) => ({
    key,
    name: formula.name,
    description: formula.description,
  }));
}
