import prisma from '../config/prisma.js';
import { calculateRiskScore, calculateSafetyScore, calculateStarRating, updateRoadStarRating } from '../utils/ratingAlgorithm.js';

export const getAdminDashboard = async (req, res) => {
  try {
    const { email } = req.user;

    const admin = await prisma.admin.findUnique({
      where: { email },
      include: {
        user: {
          select: { name: true, phone: true, email: true }
        }
      }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Get statistics
    const totalRoads = await prisma.road.count();
    const verifiedRoads = await prisma.road.count({ where: { isVerified: true } });
    const pendingFeedbacks = await prisma.feedback.count({ where: { status: 'PENDING' } });
    const totalAnnotators = await prisma.annotator.count();
    const pendingLabels = await prisma.label.count({ where: { isVerified: false } });

    res.status(200).json({
      success: true,
      data: {
        admin,
        stats: {
          totalRoads,
          verifiedRoads,
          pendingVerification: totalRoads - verifiedRoads,
          pendingFeedbacks,
          totalAnnotators,
          pendingLabels
        }
      }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard',
      error: error.message
    });
  }
};

export const getAdminMap = async (req, res) => {
  try {
    const roads = await prisma.road.findMany({
      include: {
        annotator: {
          select: { email: true, workArea: true }
        },
        segments: {
          include: {
            labels: {
              include: {
                roadside: true,
                intersection: true,
                speed: true
              }
            },
            starRatings: true
          }
        }
      }
    });

    // Parse coordinates and format roads for frontend
    const formattedRoads = roads.map(road => {
      let startCoord = null;
      let endCoord = null;
      
      try {
        startCoord = road.rStartCoord ? JSON.parse(road.rStartCoord) : null;
        endCoord = road.rEndCoord ? JSON.parse(road.rEndCoord) : null;
      } catch (e) {
        console.warn(`Failed to parse coordinates for road ${road.roadID}:`, e);
      }

      const formattedSegments = road.segments.map(segment => {
        let sStartCoord = null;
        let sEndCoord = null;
        
        try {
          sStartCoord = segment.sStartCoord ? JSON.parse(segment.sStartCoord) : null;
          sEndCoord = segment.sEndCoord ? JSON.parse(segment.sEndCoord) : null;
        } catch (e) {
          console.warn(`Failed to parse segment coordinates:`, e);
        }

        return {
          ...segment,
          sStartCoord,
          sEndCoord,
          labels: segment.labels || [],
          starRatings: segment.starRatings || []
        };
      });

      return {
        ...road,
        rStartCoord: startCoord,
        rEndCoord: endCoord,
        segments: formattedSegments
      };
    });

    res.status(200).json({
      success: true,
      data: formattedRoads
    });
  } catch (error) {
    console.error('Get admin map error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch map data',
      error: error.message
    });
  }
};
export const restrictAnnotator = async (req, res) => {
  try {
    const { annotatorEmail, reason, duration } = req.body;

    if (!annotatorEmail) {
      return res.status(400).json({
        success: false,
        message: 'Annotator email is required'
      });
    }

    // Find annotator
    const annotator = await prisma.annotator.findUnique({
      where: { email: annotatorEmail }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    // Update annotator status
    const updatedAnnotator = await prisma.annotator.update({
      where: { email: annotatorEmail },
      data: {
        isActive: false,
        penaltyScore: {
          increment: 1
        }
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        email: annotatorEmail,
        message: `Your account has been restricted by admin. Reason: ${reason || 'Not specified'}`,
        type: 'RESTRICTION'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Annotator restricted successfully',
      data: updatedAnnotator
    });
  } catch (error) {
    console.error('Restrict annotator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restrict annotator',
      error: error.message
    });
  }
};

export const checkFeedback = async (req, res) => {
  try {
    const { status, priority } = req.query;

    let whereClause = {};
    if (status) whereClause.status = status;
    if (priority) whereClause.priority = { gte: parseInt(priority) };

    const feedbacks = await prisma.feedback.findMany({
      where: whereClause,
      include: {
        user: {
          select: { email: true, name: true, phone: true }
        },
        road: {
          select: { roadID: true, roadName: true, rStartCoord: true, rEndCoord: true }
        },
        segment: {
          select: { segmentID: true, sStartCoord: true, sEndCoord: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Get all annotators for mapping ID to name
    const annotators = await prisma.annotator.findMany({
      include: {
        user: { select: { name: true } }
      }
    });

    const annotatorMap = {};
    annotators.forEach(ann => {
      annotatorMap[ann.annotatorID] = ann.user?.name || 'Unknown';
    });

    // Enrich feedbacks with annotator name
    const enrichedFeedbacks = feedbacks.map(fb => ({
      ...fb,
      assignedAnnotatorName: fb.assignedAnnotatorID ? annotatorMap[fb.assignedAnnotatorID] : null
    }));

    res.status(200).json({
      success: true,
      data: enrichedFeedbacks
    });
  } catch (error) {
    console.error('Check feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedbacks',
      error: error.message
    });
  }
};

export const assignFeedbackToAnnotator = async (req, res) => {
  try {
    const { feedbackID, annotatorEmail, priority, adminRemarks } = req.body;

    console.log('=== ASSIGN FEEDBACK ===');
    console.log('Request body:', { feedbackID, annotatorEmail, priority, adminRemarks });

    if (!feedbackID || !annotatorEmail) {
      return res.status(400).json({
        success: false,
        message: 'Feedback ID and annotator email are required'
      });
    }

    // Get feedback
    const feedback = await prisma.feedback.findUnique({
      where: { feedbackID },
      include: {
        road: true,
        segment: true
      }
    });

    console.log('Feedback found:', feedback ? 'YES' : 'NO');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Get annotator by email
    const annotator = await prisma.annotator.findUnique({
      where: { email: annotatorEmail }
    });

    console.log('Annotator found:', annotator ? 'YES' : 'NO', annotator?.annotatorID);

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    // Update feedback with annotator's annotatorID
    const updatedFeedback = await prisma.feedback.update({
      where: { feedbackID },
      data: {
        assignedAnnotatorID: annotator.annotatorID,
        priority: priority || 1,
        status: 'IN_PROGRESS',
        adminRemarks: adminRemarks || null
      }
    });

    console.log('Feedback updated successfully');

    // Create notification for annotator - with null checks
    try {
      const roadName = feedback.road?.roadName || 'Unknown Road';
      const notificationMessage = `New complaint assigned: "${feedback.title}" on ${roadName}`;
      
      await prisma.notification.create({
        data: {
          email: annotatorEmail,
          message: notificationMessage,
          type: 'ASSIGNMENT',
          metadata: JSON.stringify({
            feedbackID: feedback.feedbackID,
            roadID: feedback.roadID,
            segmentID: feedback.segmentID,
            roadName: roadName,
            coordinates: feedback.coordinates
          })
        }
      });
      console.log('Notification created successfully');
    } catch (notifError) {
      console.warn('Notification creation failed:', notifError.message);
      // Continue anyway - don't let notification error block the assignment
    }

    res.status(200).json({
      success: true,
      message: 'Feedback assigned successfully',
      data: updatedFeedback
    });
  } catch (error) {
    console.error('Assign feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign feedback',
      error: error.message
    });
  }
};

export const verifyLabel = async (req, res) => {
  try {
    const { email } = req.user;
    const { labelID, isApproved, comments } = req.body;

    if (!labelID || isApproved === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Label ID and approval status are required'
      });
    }

    // Get admin ID
    const admin = await prisma.admin.findUnique({
      where: { email }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Get label with related data
    const label = await prisma.label.findUnique({
      where: { labelID },
      include: {
        segment: {
          include: { road: true }
        },
        annotator: true,
        roadside: true,
        intersection: true,
        speed: true
      }
    });

    if (!label) {
      return res.status(404).json({
        success: false,
        message: 'Label not found'
      });
    }

    // Update label
    const updatedLabel = await prisma.label.update({
      where: { labelID },
      data: {
        isVerified: isApproved,
        adminID: admin.adminID,
        verifiedAt: new Date()
      }
    });

    if (isApproved) {
      // Recalculate and update star rating if approved
      const riskScore = calculateRiskScore(
        label.intersection,
        label.speed,
        label.roadside
      );

      // Update or create star rating
      const existingRating = await prisma.starRating.findFirst({
        where: {
          segmentID: label.segmentID,
          roadID: label.segment.road.roadID
        }
      });

      if (existingRating) {
        await prisma.starRating.update({
          where: { ratingID: existingRating.ratingID },
          data: {
            riskScore,
            ratingValue: calculateStarRating(riskScore),
            safetyScore: calculateSafetyScore(riskScore)
          }
        });
      }
    }

    // Create notification for annotator
    const message = isApproved
      ? `Your label has been approved by admin.${comments ? ` Comments: ${comments}` : ''}`
      : `Your label was not approved by admin.${comments ? ` Reason: ${comments}` : ''}`;

    await prisma.notification.create({
      data: {
        email: label.annotator.email,
        message,
        type: 'VERIFICATION'
      }
    });

    res.status(200).json({
      success: true,
      message: isApproved ? 'Label approved' : 'Label rejected',
      data: updatedLabel
    });
  } catch (error) {
    console.error('Verify label error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify label',
      error: error.message
    });
  }
};

export const updateMapWithLabel = async (req, res) => {
  try {
    const { email } = req.user;
    const { roadID, segmentID, riskScore, starRating } = req.body;

    if (!roadID || !segmentID || riskScore === undefined || starRating === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Road ID, Segment ID, risk score, and star rating are required'
      });
    }

    // Get admin
    const admin = await prisma.admin.findUnique({
      where: { email }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Update road
    const updatedRoad = await prisma.road.update({
      where: { roadID },
      data: {
        isVerified: true,
        adminID: admin.adminID,
        riskScore
      }
    });

    // Create or update star rating
    const existingRating = await prisma.starRating.findFirst({
      where: {
        segmentID,
        roadID
      }
    });

    let rating;
    if (existingRating) {
      rating = await prisma.starRating.update({
        where: { ratingID: existingRating.ratingID },
        data: {
          ratingValue: starRating,
          riskScore
        }
      });
    } else {
      rating = await prisma.starRating.create({
        data: {
          segmentID,
          roadID,
          ratingValue: starRating,
          riskScore
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Map updated with label data',
      data: {
        road: updatedRoad,
        rating
      }
    });
  } catch (error) {
    console.error('Update map error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update map',
      error: error.message
    });
  }
};

export const submitAdminFeedback = async (req, res) => {
  try {
    const { email } = req.user;
    const { title, description, imageURL, coordinates, segmentID, roadID } = req.body;

    if (!title || !description || !segmentID || !roadID) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, segmentID, and roadID are required'
      });
    }

    const feedback = await prisma.feedback.create({
      data: {
        title,
        description,
        imageURL,
        coordinates: JSON.stringify(coordinates),
        status: 'PENDING',
        feedbackType: 'FEEDBACK',
        email,
        segmentID,
        roadID
      }
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback
    });
  } catch (error) {
    console.error('Submit admin feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
};

export const getAdminRoute = async (req, res) => {
  try {
    const { segmentID } = req.query;

    if (!segmentID) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }

    const segment = await prisma.roadSegment.findUnique({
      where: { segmentID },
      include: {
        labels: {
          include: {
            roadside: true,
            intersection: true,
            speed: true,
            annotator: {
              select: { email: true }
            }
          }
        },
        starRatings: {
          include: {
            navigationRoutes: true
          }
        },
        road: true,
        feedbacks: true
      }
    });

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: segment
    });
  } catch (error) {
    console.error('Get admin route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch route',
      error: error.message
    });
  }
};

// Get pending labels for review by admin
export const getPendingLabelsForReview = async (req, res) => {
  try {
    // First, get all pending label reviews
    const pendingReviews = await prisma.labelReview.findMany({
      where: {
        status: 'PENDING'
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Then fetch labels separately
    const labels = await prisma.label.findMany({
      where: {
        labelID: {
          in: pendingReviews.map(r => r.labelID)
        }
      },
      include: {
        segment: {
          include: {
            road: true
          }
        },
        annotator: {
          select: { email: true, workArea: true }
        },
        roadside: true,
        intersection: true,
        speed: true
      }
    });

    // Combine with review data
    const pendingLabels = labels.map(label => {
      const review = pendingReviews.find(r => r.labelID === label.labelID);
      return {
        ...label,
        review
      };
    });

    res.status(200).json({
      success: true,
      data: pendingLabels
    });
  } catch (error) {
    console.error('Get pending labels error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending labels',
      error: error.message,
      errorCode: error.code
    });
  }
};

// Approve a label review
export const approveLabelReview = async (req, res) => {
  try {
    const { email } = req.user;
    const { labelID, feedbackID } = req.body;

    if (!labelID) {
      return res.status(400).json({
        success: false,
        message: 'Label ID is required'
      });
    }

    // Get admin
    const admin = await prisma.admin.findUnique({
      where: { email }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Get label with related data
    const label = await prisma.label.findUnique({
      where: { labelID },
      include: {
        annotator: true,
        review: true,
        roadside: true,
        intersection: true,
        speed: true,
        segment: {
          include: { road: true }
        }
      }
    });

    if (!label) {
      return res.status(404).json({
        success: false,
        message: 'Label not found'
      });
    }

    // Find and delete previous labels by the same annotator on this segment (keep only the latest approved one)
    const previousLabels = await prisma.label.findMany({
      where: {
        segmentID: label.segmentID,
        annotatorID: label.annotatorID,
        labelID: { not: labelID },
        isVerified: true
      },
      include: {
        roadside: true,
        intersection: true,
        speed: true,
        review: true
      }
    });

    // Delete previous verified labels and their related data
    for (const prevLabel of previousLabels) {
      if (prevLabel.roadside) {
        await prisma.roadside.delete({ where: { roadsideID: prevLabel.roadside.roadsideID } });
      }
      if (prevLabel.intersection) {
        await prisma.intersection.delete({ where: { intersectionID: prevLabel.intersection.intersectionID } });
      }
      if (prevLabel.speed) {
        await prisma.speed.delete({ where: { speedID: prevLabel.speed.speedID } });
      }
      if (prevLabel.review) {
        await prisma.labelReview.delete({ where: { reviewID: prevLabel.review.reviewID } });
      }
      await prisma.label.delete({ where: { labelID: prevLabel.labelID } });
    }

    // Update label as verified
    const updatedLabel = await prisma.label.update({
      where: { labelID },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        adminID: admin.adminID
      }
    });

    // Update review status to approved
    let updatedReview;
    if (!label.review) {
      // Create review if it doesn't exist
      updatedReview = await prisma.labelReview.create({
        data: {
          labelID,
          status: 'APPROVED',
          adminID: admin.adminID,
          approvedAt: new Date()
        }
      });
    } else {
      // Update existing review
      updatedReview = await prisma.labelReview.update({
        where: { labelID },
        data: {
          status: 'APPROVED',
          adminID: admin.adminID,
          approvedAt: new Date()
        }
      });
    }

    // Create congratulations notification for annotator
    await prisma.notification.create({
      data: {
        email: label.annotator.email,
        message: `Congratulations! Your label on ${label.segment.road.roadName} has been approved by admin.`,
        type: 'LABEL_APPROVED'
      }
    });

    // Check if this label resolves a complaint
    // First try to get feedbackID from the request body, then from review remarks (for complaint relabels)
    let resolvedFeedbackID = feedbackID;
    
    if (!resolvedFeedbackID && label.review?.remarks) {
      try {
        const reviewMetadata = JSON.parse(label.review.remarks);
        if (reviewMetadata.feedbackID && reviewMetadata.isComplaintRelabel) {
          resolvedFeedbackID = reviewMetadata.feedbackID;
          console.log('Found feedbackID from review remarks:', resolvedFeedbackID);
        }
      } catch (e) {
        // Not JSON or no feedbackID, continue
      }
    }

    if (resolvedFeedbackID) {
      const feedback = await prisma.feedback.findUnique({
        where: { feedbackID: resolvedFeedbackID },
        include: { user: true }
      });

      if (feedback) {
        // Update feedback as resolved
        await prisma.feedback.update({
          where: { feedbackID: resolvedFeedbackID },
          data: {
            status: 'RESOLVED',
            resolvedLabelID: labelID,
            resolvedAt: new Date()
          }
        });

        // Notify the traveller that their complaint was addressed
        await prisma.notification.create({
          data: {
            email: feedback.email,
            message: `Great news! Your complaint "${feedback.title}" on ${label.segment.road.roadName} has been addressed. The road labeling has been updated.`,
            type: 'COMPLAINT_RESOLVED',
            metadata: JSON.stringify({
              feedbackID: feedback.feedbackID,
              roadName: label.segment.road.roadName,
              resolvedAt: new Date().toISOString()
            })
          }
        });
      }
    }

    // Also check for any other IN_PROGRESS feedback assigned to this annotator
    // This is a fallback for any edge cases not caught above
    if (!resolvedFeedbackID) {
      const relatedFeedback = await prisma.feedback.findFirst({
        where: {
          status: 'IN_PROGRESS',
          assignedAnnotatorID: label.annotator.email
        },
        orderBy: { updatedAt: 'desc' }
      });

      if (relatedFeedback) {
        // Update feedback as resolved
        await prisma.feedback.update({
          where: { feedbackID: relatedFeedback.feedbackID },
          data: {
            status: 'RESOLVED',
            resolvedLabelID: labelID,
            resolvedAt: new Date()
          }
        });

        // Notify the traveller
        await prisma.notification.create({
          data: {
            email: relatedFeedback.email,
            message: `Great news! Your complaint "${relatedFeedback.title}" on ${label.segment.road.roadName} has been addressed. The road labeling has been updated.`,
            type: 'COMPLAINT_RESOLVED',
            metadata: JSON.stringify({
              feedbackID: relatedFeedback.feedbackID,
              roadName: label.segment.road.roadName,
              resolvedAt: new Date().toISOString()
            })
          }
        });
      }
    }

    // Calculate and update road star rating
    try {
      const roadID = label.segment.road.roadID;
      await updateRoadStarRating(roadID);
    } catch (ratingError) {
      console.warn('Error calculating road rating:', ratingError);
      // Continue anyway, rating calculation errors shouldn't block label approval
    }

    res.status(200).json({
      success: true,
      message: 'Label approved successfully',
      data: {
        label: updatedLabel,
        review: updatedReview
      }
    });
  } catch (error) {
    console.error('Approve label error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve label',
      error: error.message
    });
  }
};

// Reject a label review
export const rejectLabelReview = async (req, res) => {
  try {
    const { email } = req.user;
    const { labelID, remarks } = req.body;

    if (!labelID) {
      return res.status(400).json({
        success: false,
        message: 'Label ID is required'
      });
    }

    // Get admin
    const admin = await prisma.admin.findUnique({
      where: { email }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Get label with related data
    const label = await prisma.label.findUnique({
      where: { labelID },
      include: {
        annotator: true,
        review: true,
        roadside: true,
        intersection: true,
        speed: true,
        segment: {
          include: { road: true }
        }
      }
    });

    if (!label) {
      return res.status(404).json({
        success: false,
        message: 'Label not found'
      });
    }

    // Update review status to rejected
    if (!label.review) {
      // Create review if it doesn't exist
      await prisma.labelReview.create({
        data: {
          labelID,
          status: 'REJECTED',
          adminID: admin.adminID,
          rejectedAt: new Date(),
          remarks: remarks || null
        }
      });
    } else {
      // Update existing review
      await prisma.labelReview.update({
        where: { labelID },
        data: {
          status: 'REJECTED',
          adminID: admin.adminID,
          rejectedAt: new Date(),
          remarks: remarks || null
        }
      });
    }

    // Delete all related data (roadside, intersection, speed, and label)
    if (label.roadside) {
      await prisma.roadside.delete({
        where: { roadsideID: label.roadside.roadsideID }
      });
    }

    if (label.intersection) {
      await prisma.intersection.delete({
        where: { intersectionID: label.intersection.intersectionID }
      });
    }

    if (label.speed) {
      await prisma.speed.delete({
        where: { speedID: label.speed.speedID }
      });
    }

    // Delete the label itself
    await prisma.label.delete({
      where: { labelID }
    });

    // Increment penalty score for the annotator
    const updatedAnnotator = await prisma.annotator.update({
      where: { annotatorID: label.annotator.annotatorID },
      data: {
        penaltyScore: { increment: 1 }
      }
    });

    // Check if penalty crossed 3 - suspend the annotator
    let suspensionMessage = '';
    if (updatedAnnotator.penaltyScore >= 3 && !updatedAnnotator.isSuspended) {
      await prisma.annotator.update({
        where: { annotatorID: label.annotator.annotatorID },
        data: {
          isSuspended: true,
          suspendedAt: new Date()
        }
      });
      suspensionMessage = ' You have been suspended from labeling due to multiple rejections. Please wait for admin training remarks.';
    }

    // Create rejection notification for annotator with remarks and penalty info
    const remarksMessage = remarks ? ` Remarks: ${remarks}` : '';
    const penaltyMessage = ` (Penalty: ${updatedAnnotator.penaltyScore}/3)`;
    await prisma.notification.create({
      data: {
        email: label.annotator.email,
        message: `Your label on ${label.segment.road.roadName} was not approved by admin.${remarksMessage}${penaltyMessage}${suspensionMessage}`,
        type: 'LABEL_REJECTED'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Label rejected and deleted successfully',
      data: {
        penaltyScore: updatedAnnotator.penaltyScore,
        isSuspended: updatedAnnotator.penaltyScore >= 3
      }
    });
  } catch (error) {
    console.error('Reject label error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject label',
      error: error.message
    });
  }
};

export const seedTestData = async (req, res) => {
  try {
    // Get an annotator to assign roads to
    const annotator = await prisma.annotator.findFirst();
    
    if (!annotator) {
      return res.status(400).json({
        success: false,
        message: 'No annotators found. Please create an annotator first.'
      });
    }

    // Create test roads with segments
    const testRoads = [
      {
        roadName: 'Dhaka Main Road',
        rStartCoord: JSON.stringify({ lat: 23.8103, lng: 90.4125 }),
        rEndCoord: JSON.stringify({ lat: 23.8150, lng: 90.4200 }),
        segments: [
          { sStartCoord: JSON.stringify({ lat: 23.8103, lng: 90.4125 }), sEndCoord: JSON.stringify({ lat: 23.8120, lng: 90.4150 }) },
          { sStartCoord: JSON.stringify({ lat: 23.8120, lng: 90.4150 }), sEndCoord: JSON.stringify({ lat: 23.8135, lng: 90.4175 }) },
          { sStartCoord: JSON.stringify({ lat: 23.8135, lng: 90.4175 }), sEndCoord: JSON.stringify({ lat: 23.8150, lng: 90.4200 }) }
        ]
      },
      {
        roadName: 'Gulshan Avenue',
        rStartCoord: JSON.stringify({ lat: 23.8061, lng: 90.4181 }),
        rEndCoord: JSON.stringify({ lat: 23.8100, lng: 90.4250 }),
        segments: [
          { sStartCoord: JSON.stringify({ lat: 23.8061, lng: 90.4181 }), sEndCoord: JSON.stringify({ lat: 23.8075, lng: 90.4210 }) },
          { sStartCoord: JSON.stringify({ lat: 23.8075, lng: 90.4210 }), sEndCoord: JSON.stringify({ lat: 23.8100, lng: 90.4250 }) }
        ]
      },
      {
        roadName: 'Banani Road',
        rStartCoord: JSON.stringify({ lat: 23.8305, lng: 90.4180 }),
        rEndCoord: JSON.stringify({ lat: 23.8350, lng: 90.4250 }),
        segments: [
          { sStartCoord: JSON.stringify({ lat: 23.8305, lng: 90.4180 }), sEndCoord: JSON.stringify({ lat: 23.8325, lng: 90.4215 }) },
          { sStartCoord: JSON.stringify({ lat: 23.8325, lng: 90.4215 }), sEndCoord: JSON.stringify({ lat: 23.8350, lng: 90.4250 }) }
        ]
      }
    ];

    const createdRoads = [];

    for (const roadData of testRoads) {
      // Create road
      const road = await prisma.road.create({
        data: {
          roadName: roadData.roadName,
          rStartCoord: roadData.rStartCoord,
          rEndCoord: roadData.rEndCoord,
          annotatorID: annotator.annotatorID,
          isVerified: false
        }
      });

      // Create segments for the road
      const segments = [];
      for (const segmentData of roadData.segments) {
        const segment = await prisma.roadSegment.create({
          data: {
            sStartCoord: segmentData.sStartCoord,
            sEndCoord: segmentData.sEndCoord,
            roadID: road.roadID
          }
        });
        segments.push(segment);
      }

      createdRoads.push({
        road,
        segments
      });
    }

    res.status(201).json({
      success: true,
      message: `Test data created successfully. Created ${createdRoads.length} roads with segments.`,
      data: createdRoads
    });
  } catch (error) {
    console.error('Seed test data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed test data',
      error: error.message
    });
  }
};

// Get suspended annotators for admin management
export const getSuspendedAnnotators = async (req, res) => {
  try {
    const suspendedAnnotators = await prisma.annotator.findMany({
      where: {
        isSuspended: true
      },
      include: {
        user: {
          select: { name: true, email: true, phone: true }
        },
        labels: {
          where: { isVerified: false }
        }
      },
      orderBy: {
        suspendedAt: 'desc'
      }
    });

    // Also get annotators with high penalty (2 or more) but not yet suspended
    const warningAnnotators = await prisma.annotator.findMany({
      where: {
        penaltyScore: { gte: 2 },
        isSuspended: false
      },
      include: {
        user: {
          select: { name: true, email: true, phone: true }
        }
      },
      orderBy: {
        penaltyScore: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: {
        suspended: suspendedAnnotators,
        warning: warningAnnotators,
        totalSuspended: suspendedAnnotators.length,
        totalWarning: warningAnnotators.length
      }
    });
  } catch (error) {
    console.error('Get suspended annotators error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suspended annotators',
      error: error.message
    });
  }
};

// Add training remarks to suspended annotator
export const addTrainingRemarks = async (req, res) => {
  try {
    const { annotatorID, remarks } = req.body;

    if (!annotatorID || !remarks) {
      return res.status(400).json({
        success: false,
        message: 'Annotator ID and remarks are required'
      });
    }

    const annotator = await prisma.annotator.findUnique({
      where: { annotatorID },
      include: { user: true }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    // Update annotator with suspension remarks
    const updatedAnnotator = await prisma.annotator.update({
      where: { annotatorID },
      data: {
        suspensionRemarks: remarks
      }
    });

    // Notify annotator about training remarks
    await prisma.notification.create({
      data: {
        email: annotator.email,
        message: `Admin has provided training remarks for you: "${remarks}". Please review and improve your labeling quality.`,
        type: 'INFO'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Training remarks added successfully',
      data: updatedAnnotator
    });
  } catch (error) {
    console.error('Add training remarks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add training remarks',
      error: error.message
    });
  }
};

// Reactivate suspended annotator after training
export const reactivateAnnotator = async (req, res) => {
  try {
    const { annotatorID } = req.body;

    if (!annotatorID) {
      return res.status(400).json({
        success: false,
        message: 'Annotator ID is required'
      });
    }

    const annotator = await prisma.annotator.findUnique({
      where: { annotatorID },
      include: { user: true }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    if (!annotator.isSuspended) {
      return res.status(400).json({
        success: false,
        message: 'Annotator is not suspended'
      });
    }

    // Reactivate annotator - reset penalty and suspension
    const updatedAnnotator = await prisma.annotator.update({
      where: { annotatorID },
      data: {
        isSuspended: false,
        penaltyScore: 0,
        suspendedAt: null,
        suspensionRemarks: null
      }
    });

    // Notify annotator about reactivation
    await prisma.notification.create({
      data: {
        email: annotator.email,
        message: 'Your account has been reactivated. You can now resume labeling. Please ensure to follow the proper labeling guidelines.',
        type: 'INFO'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Annotator reactivated successfully',
      data: updatedAnnotator
    });
  } catch (error) {
    console.error('Reactivate annotator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reactivate annotator',
      error: error.message
    });
  }
};

// Get all annotators with their statistics
export const getAllAnnotators = async (req, res) => {
  try {
    const { search } = req.query;

    // Build where clause for search
    let whereClause = {};
    if (search) {
      whereClause = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } }
        ]
      };
    }

    const annotators = await prisma.annotator.findMany({
      where: whereClause,
      include: {
        user: {
          select: { name: true, email: true, phone: true, createdAt: true }
        },
        labels: {
          select: {
            labelID: true,
            isVerified: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format annotators with statistics
    const formattedAnnotators = annotators.map(annotator => {
      const totalLabels = annotator.labels.length;
      const verifiedLabels = annotator.labels.filter(l => l.isVerified).length;
      const pendingLabels = totalLabels - verifiedLabels;
      
      return {
        annotatorID: annotator.annotatorID,
        email: annotator.email,
        name: annotator.user?.name || 'Unknown',
        phone: annotator.user?.phone || 'N/A',
        workArea: annotator.workArea || 'Not assigned',
        penaltyScore: annotator.penaltyScore,
        isSuspended: annotator.isSuspended,
        suspensionRemarks: annotator.suspensionRemarks,
        suspendedAt: annotator.suspendedAt,
        isActive: annotator.isActive,
        joinedAt: annotator.user?.createdAt || annotator.createdAt,
        statistics: {
          totalLabels,
          verifiedLabels,
          pendingLabels,
          approvalRate: totalLabels > 0 ? Math.round((verifiedLabels / totalLabels) * 100) : 0
        }
      };
    });

    res.status(200).json({
      success: true,
      data: {
        annotators: formattedAnnotators,
        total: formattedAnnotators.length
      }
    });
  } catch (error) {
    console.error('Get all annotators error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch annotators',
      error: error.message
    });
  }
};

// Get road star rating
export const getRoadRating = async (req, res) => {
  try {
    const { roadID } = req.params;

    if (!roadID) {
      return res.status(400).json({
        success: false,
        message: 'Road ID is required'
      });
    }

    // Get the road with its star ratings
    const road = await prisma.road.findUnique({
      where: { roadID },
      include: {
        segments: {
          include: {
            starRatings: true,
            labels: {
              where: { isVerified: true },
              select: { labelID: true, createdAt: true }
            }
          }
        }
      }
    });

    if (!road) {
      return res.status(404).json({
        success: false,
        message: 'Road not found'
      });
    }

    // Calculate average rating from all segments
    const allRatings = road.segments.flatMap(s => s.starRatings);
    const averageRating = allRatings.length > 0
      ? Math.round((allRatings.reduce((sum, r) => sum + r.ratingValue, 0) / allRatings.length) * 10) / 10
      : 0;

    const totalLabels = road.segments.reduce((sum, s) => sum + s.labels.length, 0);

    res.status(200).json({
      success: true,
      data: {
        roadID: road.roadID,
        roadName: road.roadName,
        overallRating: averageRating,
        isVerified: road.isVerified,
        riskScore: road.riskScore,
        totalLabels,
        segments: road.segments.map(s => ({
          segmentID: s.segmentID,
          rating: s.starRatings[0]?.ratingValue || 0,
          labelCount: s.labels.length
        }))
      }
    });
  } catch (error) {
    console.error('Get road rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch road rating',
      error: error.message
    });
  }
};
