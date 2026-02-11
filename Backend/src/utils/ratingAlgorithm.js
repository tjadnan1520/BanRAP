import prisma from '../config/prisma.js';

// ===== SPEED SCORE CALCULATION =====
const calculateSpeedScore = (speedLabels) => {
  /*
    Logic:
    - Present + High speed (100-120) = 5 stars (Safe highway)
    - Present + Medium speed (50-80) = 4 stars (Safe urban)
    - Present + Low speed (20-40) = 3 stars (Residential, needs caution)
    - Not Present = 2 stars (Speed limit unclear)
    - Score: Average of all segment speeds
  */

  const speedMap = {
    'present': 1,
    'not_present': 0,
    '20': 1.5,
    '30': 2,
    '40': 2.5,
    '50': 3.5,
    '60': 4,
    '80': 4.5,
    '100': 5,
    '120': 5
  };

  let totalScore = 0;
  let count = 0;

  speedLabels.forEach(label => {
    if (label.speed) {
      const speed = label.speed.management?.toString().toLowerCase();
      const presence = label.speed.speedLimit?.toString().toLowerCase();
      
      // If speed is not present, use lower score
      if (presence === 'not present' || presence === 'not_present') {
        totalScore += 2;
      } else if (speedMap[speed] !== undefined) {
        totalScore += speedMap[speed];
      } else {
        totalScore += 2.5; // Default
      }
      count++;
    }
  });

  return count > 0 ? totalScore / count : 2.5;
};

// ===== ROADSIDE SCORE CALCULATION =====
const calculateRoadsideScore = (roadsideLabels) => {
  /*
    Logic:
    - Object Type: metal/concrete barriers = safer (higher score)
    - Bus/truck = moderate (medium score)
    - Residual = least safe (lower score)
    - Distance: 
      * 0-1m = Very risky (1 star)
      * 1-5m = Risky (2 stars)
      * 5-10m = Acceptable (3 stars)
      * 10+m = Safe (5 stars)
    Average left and right sides
  */

  const objectTypeScore = {
    'metal': 5,
    'concrete': 5,
    'bus': 2,
    'truck': 2,
    'residual': 1
  };

  const distanceScore = {
    '0-1': 1,
    '1-5': 2,
    '5-10': 3,
    '10+': 5
  };

  let leftScore = 0;
  let rightScore = 0;
  let leftCount = 0;
  let rightCount = 0;

  roadsideLabels.forEach(label => {
    if (label.roadside) {
      // Left side scoring
      if (label.roadside.leftObject) {
        const objScore = objectTypeScore[label.roadside.leftObject?.toLowerCase()] || 2.5;
        const distScore = distanceScore[label.roadside.distanceObject?.toString()] || 2.5;
        leftScore += (objScore + distScore) / 2;
        leftCount++;
      }

      // Right side scoring
      if (label.roadside.rightObject) {
        const objScore = objectTypeScore[label.roadside.rightObject?.toLowerCase()] || 2.5;
        const distScore = distanceScore[label.roadside.distanceObject?.toString()] || 2.5;
        rightScore += (objScore + distScore) / 2;
        rightCount++;
      }
    }
  });

  const avgLeft = leftCount > 0 ? leftScore / leftCount : 2.5;
  const avgRight = rightCount > 0 ? rightScore / rightCount : 2.5;
  
  return {
    leftScore: avgLeft,
    rightScore: avgRight,
    average: (avgLeft + avgRight) / 2
  };
};

// ===== INTERSECTION SCORE CALCULATION =====
const calculateIntersectionScore = (intersectionLabels) => {
  /*
    Logic:
    - Intersection Type:
      * Railway crossing = 1 star (Most dangerous)
      * Merge lane = 2 stars
      * 3leg = 2 stars
      * 4leg = 3 stars
      * 4leg-signalised = 4 stars
      * 3leg-signalised = 4 stars
      * Roundabout = 5 stars (Safest)
    
    - Quality:
      * Poor = -1 (Deduct score)
      * Adequate = +0 (Neutral)
      * Not applicable = 0 (No impact)
    
    - Channelisation:
      * Present = +0.5 (Better organization)
      * Not present = -0.5 (Less organized)
  */

  const intersectionTypeScore = {
    'railway crossing': 1,
    'merge lane': 2,
    '3leg': 2,
    '4leg': 3,
    '3leg signalized': 4,
    '3leg-signalized': 4,
    '4leg signalised': 4,
    '4leg-signalised': 4,
    'roundabout': 5
  };

  const qualityModifier = {
    'poor': -1,
    'adequate': 0,
    'not applicable': 0
  };

  const channelisationModifier = {
    'present': 0.5,
    'not present': -0.5
  };

  let totalScore = 0;
  let count = 0;

  intersectionLabels.forEach(label => {
    if (label.intersection) {
      let segmentScore = 3; // Default score

      // Intersection type
      const intType = label.intersection.type?.toLowerCase();
      if (intType && intersectionTypeScore[intType] !== undefined) {
        segmentScore = intersectionTypeScore[intType];
      }

      // Quality modifier
      const quality = label.intersection.quality?.toLowerCase();
      if (quality && qualityModifier[quality] !== undefined) {
        segmentScore += qualityModifier[quality];
      }

      // Channelisation modifier
      const channel = label.intersection.channelisation?.toLowerCase();
      if (channel && channelisationModifier[channel] !== undefined) {
        segmentScore += channelisationModifier[channel];
      }

      // Ensure score stays within 1-5 range
      segmentScore = Math.min(5, Math.max(1, segmentScore));
      totalScore += segmentScore;
      count++;
    }
  });

  return count > 0 ? totalScore / count : 2.5;
};

// ===== MAIN CALCULATION FUNCTION =====
export const calculateRoadStarRating = async (roadID) => {
  try {
    // Fetch all verified labels for this road with all relations
    const road = await prisma.road.findUnique({
      where: { roadID },
      include: {
        segments: {
          include: {
            labels: {
              where: { isVerified: true },
              include: {
                speed: true,
                roadside: true,
                intersection: true
              }
            }
          }
        }
      }
    });

    if (!road) {
      return null;
    }

    // Collect all labels from all segments
    const allLabels = road.segments.flatMap(segment => segment.labels);

    if (allLabels.length === 0) {
      return null; // Not enough data
    }

    let scores = {
      speedScore: 0,
      roadsideScore: 0,
      intersectionScore: 0,
      totalWeight: 0
    };

    // Calculate Speed Score (Weight: 20%)
    const speedLabels = allLabels.filter(l => l.speed);
    if (speedLabels.length > 0) {
      const speedScore = calculateSpeedScore(speedLabels);
      scores.speedScore = speedScore * 0.20;
      scores.totalWeight += 0.20;
    }

    // Calculate Roadside Score (Weight: 40%)
    const roadsideLabels = allLabels.filter(l => l.roadside);
    if (roadsideLabels.length > 0) {
      const roadsideScores = calculateRoadsideScore(roadsideLabels);
      scores.roadsideScore = roadsideScores.average * 0.40;
      scores.totalWeight += 0.40;
    }

    // Calculate Intersection Score (Weight: 40%)
    const intersectionLabels = allLabels.filter(l => l.intersection);
    if (intersectionLabels.length > 0) {
      const intersectionScore = calculateIntersectionScore(intersectionLabels);
      scores.intersectionScore = intersectionScore * 0.40;
      scores.totalWeight += 0.40;
    }

    // Calculate final rating
    const totalScore = 
      scores.speedScore + 
      scores.roadsideScore + 
      scores.intersectionScore;

    const finalRating = scores.totalWeight > 0 
      ? Math.round((totalScore / scores.totalWeight) * 10) / 10 
      : 0;

    // Convert to 1-5 star scale
    const starRating = Math.min(5, Math.max(1, finalRating));

    return {
      rating: starRating,
      breakdown: {
        speedScore: speedLabels.length > 0 ? calculateSpeedScore(speedLabels) : 0,
        roadsideScore: roadsideLabels.length > 0 ? calculateRoadsideScore(roadsideLabels).average : 0,
        intersectionScore: intersectionLabels.length > 0 ? calculateIntersectionScore(intersectionLabels) : 0
      },
      labelCount: allLabels.length,
      confidence: (scores.totalWeight / 1.0) * 100 // Percentage of complete data
    };
  } catch (error) {
    console.error('Error calculating road star rating:', error);
    throw error;
  }
};

// Update road star rating in database
export const updateRoadStarRating = async (roadID) => {
  try {
    const rating = await calculateRoadStarRating(roadID);
    
    if (rating) {
      // Create or update StarRating entries for segments
      const road = await prisma.road.findUnique({
        where: { roadID },
        include: { segments: true }
      });

      if (road && road.segments.length > 0) {
        for (const segment of road.segments) {
          await prisma.starRating.deleteMany({
            where: { segmentID: segment.segmentID }
          });

          await prisma.starRating.create({
            data: {
              ratingValue: Math.round(rating.rating),
              riskScore: 6 - rating.rating, // Inverse of rating
              safetyScore: rating.rating,
              segmentID: segment.segmentID,
              roadID: roadID
            }
          });
        }
      }

      // Update road isVerified if all segments are labeled
      const totalSegments = road?.segments.length || 0;
      const labeledSegments = road?.segments.filter(s => s.labels?.length > 0).length || 0;

      if (totalSegments > 0 && labeledSegments === totalSegments) {
        await prisma.road.update({
          where: { roadID },
          data: {
            isVerified: true,
            riskScore: 6 - rating.rating
          }
        });
      }

      console.log(`Road ${roadID} rating updated: ${rating.rating} stars`);
      return rating;
    }
  } catch (error) {
    console.error('Error updating road star rating:', error);
    throw error;
  }
};

// Legacy function for backward compatibility
export const calculateRiskScore = (intersectionData, speedData, roadsideData) => {
  let riskScore = 0;

  if (intersectionData) {
    const intersectionTypes = {
      'railway crossing': 5,
      'merge lane': 3,
      '3leg': 3,
      '4leg': 4,
      '3leg signalized': 2,
      '4leg signalised': 2,
      'roundabout': 1
    };
    riskScore += intersectionTypes[intersectionData.type?.toLowerCase()] || 0;

    const qualityRisk = {
      'poor': 3,
      'adequate': 1,
      'not applicable': 0
    };
    riskScore += qualityRisk[intersectionData.quality?.toLowerCase()] || 0;

    if (intersectionData.channelisation?.toLowerCase() === 'not present') {
      riskScore += 2;
    }
  }

  if (speedData) {
    if (speedData.speedLimit?.toLowerCase() === 'not present') {
      riskScore += 3;
    }
    const managementValue = parseInt(speedData.management) || 50;
    riskScore += Math.max(0, 5 - (managementValue / 20));
  }

  if (roadsideData) {
    const objectRisk = {
      'metal': 1,
      'concrete': 1,
      'bus': 2,
      'truck': 2,
      'residual': 5
    };
    riskScore += objectRisk[roadsideData.leftObject?.toLowerCase()] || 2;
    riskScore += objectRisk[roadsideData.rightObject?.toLowerCase()] || 2;

    const distanceRisk = {
      '0-1': 5,
      '1-5': 3,
      '5-10': 2,
      '10+': 1
    };
    const distance = roadsideData.distanceObject || '10+';
    riskScore += distanceRisk[distance] || 1;
  }

  const normalizedScore = Math.min(5, Math.ceil(riskScore / 5));
  return normalizedScore;
};

export const calculateSafetyScore = (riskScore) => {
  return Math.round((6 - riskScore) * 20) / 100;
};

export const calculateStarRating = (riskScore) => {
  const starRating = Math.ceil(6 - riskScore);
  return Math.max(1, Math.min(5, starRating));
};
