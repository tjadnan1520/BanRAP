import prisma from '../config/prisma.js';
import { calculateRiskScore, calculateSafetyScore, calculateStarRating } from '../utils/ratingAlgorithm.js';

// Get notifications for the current user
export const getNotifications = async (req, res) => {
  try {
    const { email } = req.user;

    const notifications = await prisma.notification.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' }
    });

    // Group notifications by type
    const grouped = {
      LABEL_SUBMITTED: [],
      LABEL_APPROVED: [],
      LABEL_REJECTED: [],
      ASSIGNMENT: [],
      RESTRICTION: [],
      VERIFICATION: [],
      INFO: []
    };

    notifications.forEach(notif => {
      const type = notif.type || 'INFO';
      if (grouped[type]) {
        grouped[type].push(notif);
      } else {
        grouped.INFO.push(notif);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        total: notifications.length,
        notifications,
        grouped
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationID } = req.body;

    if (!notificationID) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required'
      });
    }

    const notification = await prisma.notification.update({
      where: { notificationID },
      data: { isRead: true }
    });

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

// Public endpoint for getting sample roads (no authentication required)
export const getSampleRoads = async (req, res) => {
  try {
    // Fetch actual roads from database with their segments
    const roads = await prisma.road.findMany({
      include: {
        segments: true
      },
      take: 10
    });

    if (roads.length > 0) {
      // Format segments properly
      const formattedRoads = roads.map(road => ({
        roadID: road.roadID,
        roadName: road.roadName,
        location: 'Dhaka, Bangladesh',
        isVerified: road.isVerified,
        segments: road.segments.map((segment, index) => ({
          segmentID: segment.segmentID,
          segmentName: `Segment ${index + 1}`,
          distance: 500,
          sStartCoord: segment.sStartCoord,  // Include coordinates for mapping
          sEndCoord: segment.sEndCoord
        }))
      }));

      return res.status(200).json({
        success: true,
        data: {
          roads: formattedRoads
        }
      });
    }

    // Return empty if no roads exist
    res.status(200).json({
      success: true,
      data: {
        roads: []
      }
    });
  } catch (error) {
    console.error('Get sample roads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roads',
      error: error.message
    });
  }
};

export const getAnnotatorDashboard = async (req, res) => {
  try {
    const { email } = req.user;

    const annotator = await prisma.annotator.findUnique({
      where: { email },
      include: {
        user: {
          select: { name: true, phone: true, email: true }
        },
        roads: {
          include: {
            segments: true
          }
        },
        labels: {
          orderBy: { createdAt: 'desc' },
          include: {
            segment: {
              include: {
                road: true
              }
            },
            roadside: true,
            intersection: true,
            speed: true
          }
        }
      }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    // Get stats
    const totalRoads = annotator.roads.length;
    const totalLabels = annotator.labels.length;
    const verifiedLabels = annotator.labels.filter(l => l.isVerified).length;
    const pendingLabels = totalLabels - verifiedLabels;

    // Format roads with parsed coordinates
    const formattedRoads = annotator.roads.map(road => {
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
          sEndCoord
        };
      });

      return {
        ...road,
        rStartCoord: startCoord,
        rEndCoord: endCoord,
        segments: formattedSegments
      };
    });

    // Format labeled roads for frontend
    const labeledRoads = annotator.labels.map(label => {
      const roadName = label.segment?.road?.roadName;
      const segmentCoords = label.segment?.sStartCoord;
      let displayName = roadName || 'Unknown Road';
      
      // Add segment location info if available
      if (segmentCoords) {
        try {
          const coords = JSON.parse(segmentCoords);
          displayName += ` (${coords.lat?.toFixed(4)}, ${coords.lng?.toFixed(4)})`;
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      return {
        id: label.labelID,
        name: displayName,
        date: new Date(label.createdAt).toLocaleDateString(),
        status: label.isVerified ? 'verified' : 'pending'
      };
    });

    res.status(200).json({
      success: true,
      data: {
        annotator,
        roads: formattedRoads,
        labeledRoads: labeledRoads,
        labels: annotator.labels,
        stats: {
          totalRoads,
          totalLabels,
          verifiedLabels,
          pendingLabels
        }
      }
    });
  } catch (error) {
    console.error('Get annotator dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard',
      error: error.message
    });
  }
};

export const getAnnotatorMap = async (req, res) => {
  try {
    // Get all roads and segments
    const roads = await prisma.road.findMany({
      include: {
        segments: {
          include: {
            labels: {
              include: {
                roadside: true,
                intersection: true,
                speed: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: roads
    });
  } catch (error) {
    console.error('Get annotator map error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch map data',
      error: error.message
    });
  }
};

export const selectCoordinatesForLabeling = async (req, res) => {
  try {
    const { email } = req.user;
    const { roadName, startCoord, endCoord, workArea } = req.body;

    if (!roadName || !startCoord || !endCoord) {
      return res.status(400).json({
        success: false,
        message: 'Road name, start coordinate, and end coordinate are required'
      });
    }

    // Get annotator ID (not email!)
    const annotator = await prisma.annotator.findUnique({
      where: { email }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    // Create road with annotator
    const road = await prisma.road.create({
      data: {
        roadName,
        rStartCoord: JSON.stringify(startCoord),
        rEndCoord: JSON.stringify(endCoord),
        annotatorID: annotator.annotatorID, // Use annotatorID, not email!
        isVerified: false
      }
    });

    // Create initial road segment
    const segment = await prisma.roadSegment.create({
      data: {
        roadID: road.roadID,
        sStartCoord: JSON.stringify(startCoord),
        sEndCoord: JSON.stringify(endCoord)
      }
    });

    res.status(201).json({
      success: true,
      message: 'Road and segment created for labeling',
      data: {
        road,
        segment
      }
    });
  } catch (error) {
    console.error('Select coordinates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create road for labeling',
      error: error.message
    });
  }
};

// Create road with multiple segments (saves to database)
export const createRoadWithSegments = async (req, res) => {
  try {
    const { email } = req.user;
    const { roadName, startPoint, endPoint, segments, routePath, totalDistance } = req.body;

    console.log('Creating road with segments:', { roadName, segmentsCount: segments?.length });

    if (!roadName || !startPoint || !endPoint || !segments || segments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Road name, start point, end point, and segments are required'
      });
    }

    // Get annotator
    const annotator = await prisma.annotator.findUnique({
      where: { email }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    // Use transaction to create road and all segments atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create the road
      const road = await tx.road.create({
        data: {
          roadName,
          rStartCoord: JSON.stringify(startPoint),
          rEndCoord: JSON.stringify(endPoint),
          annotatorID: annotator.annotatorID,
          isVerified: false
        }
      });

      console.log('Created road:', road.roadID);

      // Create all segments
      const createdSegments = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segment = await tx.roadSegment.create({
          data: {
            roadID: road.roadID,
            sStartCoord: JSON.stringify(seg.startPoint),
            sEndCoord: JSON.stringify(seg.endPoint)
          }
        });
        
        // Map segment with additional frontend info
        createdSegments.push({
          segmentID: segment.segmentID,
          segmentIndex: i,
          startPoint: seg.startPoint,
          endPoint: seg.endPoint,
          path: seg.path || [seg.startPoint, seg.endPoint],
          distance: seg.distance || 0
        });
        
        console.log(`Created segment ${i + 1}:`, segment.segmentID);
      }

      return {
        road: {
          roadID: road.roadID,
          roadName: road.roadName,
          startPoint,
          endPoint,
          isVerified: false,
          totalDistance: totalDistance || segments.reduce((sum, s) => sum + (s.distance || 0), 0)
        },
        segments: createdSegments,
        routePath: routePath || []
      };
    });

    console.log('Road created successfully with', result.segments.length, 'segments');

    res.status(201).json({
      success: true,
      message: `Road created with ${result.segments.length} segments`,
      data: result
    });

  } catch (error) {
    console.error('Create road with segments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create road with segments',
      error: error.message
    });
  }
};

export const createLabel = async (req, res) => {
  const { email } = req.user;
  const { segmentID, latitude, longitude, roadsideData, intersectionData, speedData } = req.body;

  try {
    if (!segmentID) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }

    // First, verify segment exists
    const segment = await prisma.roadSegment.findUnique({
      where: { segmentID },
      include: { road: true }
    });

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Road segment not found'
      });
    }

    if (!segment.road) {
      return res.status(400).json({
        success: false,
        message: 'Road segment is not associated with a road'
      });
    }

    // Get or verify annotator
    const annotator = await prisma.annotator.findUnique({
      where: { email }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    // Check if annotator is suspended
    if (annotator.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account is suspended due to multiple label rejections. Please wait for admin training remarks and reactivation.',
        penaltyScore: annotator.penaltyScore,
        suspensionRemarks: annotator.suspensionRemarks
      });
    }

    // Use transaction to ensure all operations succeed or all fail
    const result = await prisma.$transaction(async (tx) => {
      // Create label
      const label = await tx.label.create({
        data: {
          segmentID,
          annotatorID: annotator.annotatorID,
          isVerified: false,
          latitude: latitude || null,
          longitude: longitude || null
        }
      });

      // Create roadside data if provided
      if (roadsideData && Object.values(roadsideData).some(v => v !== null)) {
        await tx.roadside.create({
          data: {
            labelID: label.labelID,
            leftObject: roadsideData.leftObject || null,
            rightObject: roadsideData.rightObject || null,
            distanceObject: roadsideData.distanceObject || null
          }
        });
      }

      // Create intersection data if provided
      if (intersectionData && Object.values(intersectionData).some(v => v !== null)) {
        await tx.intersection.create({
          data: {
            labelID: label.labelID,
            type: intersectionData.type || null,
            quality: intersectionData.quality || null,
            channelisation: intersectionData.channelisation || null
          }
        });
      }

      // Create speed data if provided
      if (speedData && Object.values(speedData).some(v => v !== null)) {
        await tx.speed.create({
          data: {
            labelID: label.labelID,
            speedLimit: speedData.speedLimit || null,
            management: speedData.management || null
          }
        });
      }

      // Create label review entry for admin review
      await tx.labelReview.create({
        data: {
          labelID: label.labelID,
          status: 'PENDING'
        }
      });

      // Calculate risk score
      const riskScore = calculateRiskScore(intersectionData, speedData, roadsideData);

      // Create star rating
      const starRating = await tx.starRating.create({
        data: {
          segmentID,
          roadID: segment.road.roadID,
          riskScore,
          ratingValue: calculateStarRating(riskScore),
          safetyScore: calculateSafetyScore(riskScore)
        }
      });

      // Create notification for admin about new label with all labeling types included
      const allAdmins = await tx.admin.findMany({
        select: { email: true }
      });

      // Track which labeling types were included in this submission
      const labelingTypes = [];
      if (roadsideData && Object.values(roadsideData).some(v => v !== null)) {
        labelingTypes.push('Roadside');
      }
      if (intersectionData && Object.values(intersectionData).some(v => v !== null)) {
        labelingTypes.push('Intersection');
      }
      if (speedData && Object.values(speedData).some(v => v !== null)) {
        labelingTypes.push('Speed');
      }

      // Create single consolidated notification for all labeling types for this segment
      const labelingTypesStr = labelingTypes.length > 0 ? ` [${labelingTypes.join(', ')}]` : '';
      const consolidatedMessage = `New label submitted for review on ${segment.road.roadName} - Segment ${segmentID.slice(0, 8)}${labelingTypesStr}. By: ${annotator.email}. Location: ${latitude || 'Unknown'}, ${longitude || 'Unknown'}`;

      for (const admin of allAdmins) {
        await tx.notification.create({
          data: {
            email: admin.email,
            message: consolidatedMessage,
            type: 'LABEL_SUBMITTED'
          }
        });
      }

      // Create notification for the annotator about successful submission
      await tx.notification.create({
        data: {
          email: annotator.email,
          message: `✓ Label submitted successfully for ${segment.road.roadName} - Segment ${segmentID.slice(0, 8)}${labelingTypesStr}. Awaiting admin review.`,
          type: 'LABEL_SUBMITTED'
        }
      });

      return { label, starRating };
    });

    res.status(201).json({
      success: true,
      message: 'Label created successfully and submitted for review',
      data: result
    });
  } catch (error) {
    console.error('Create label error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('Request user:', req.user);
    
    // Enhanced error handling
    let errorMessage = 'Failed to create label';
    let statusCode = 500;

    if (error.code === 'P2002') {
      errorMessage = 'Duplicate label entry detected';
      statusCode = 409;
    } else if (error.code === 'P2025') {
      errorMessage = 'Referenced resource not found (segment, annotator, or admin)';
      statusCode = 404;
    } else if (error.code === 'P2003') {
      errorMessage = 'Foreign key constraint violation - check if segment and annotator exist';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message,
      errorCode: error.code
    });
  }
};

export const submitAnnotatorFeedback = async (req, res) => {
  try {
    const { email } = req.user;
    const { title, description, imageURL, coordinates, segmentID, roadID } = req.body;

    if (!title || !description || !segmentID || !roadID) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, segmentID, and roadID are required'
      });
    }

    // Verify user exists in database before creating feedback
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please log in again.'
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
    console.error('Submit annotator feedback error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reference in feedback data. Please ensure segment and road exist.',
        error: error.message
      });
    }
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate feedback detected',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
};

export const getAnnotatorRoute = async (req, res) => {
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
            speed: true
          }
        },
        starRatings: true,
        road: true
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
    console.error('Get annotator route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch route',
      error: error.message
    });
  }
};

// Get assigned complaints for annotator
export const getAssignedComplaints = async (req, res) => {
  try {
    const { email } = req.user;

    // Get the annotator to get their annotatorID
    const annotator = await prisma.annotator.findUnique({
      where: { email }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    const complaints = await prisma.feedback.findMany({
      where: {
        assignedAnnotatorID: annotator.annotatorID,
        status: { in: ['IN_PROGRESS', 'PENDING'] }
      },
      include: {
        user: {
          select: { name: true, email: true, phone: true }
        },
        road: true,
        segment: true
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Parse coordinates in complaints
    const formattedComplaints = complaints.map(complaint => {
      let roadCoords = null;
      let segmentCoords = null;

      try {
        if (complaint.road?.rStartCoord) {
          roadCoords = {
            start: JSON.parse(complaint.road.rStartCoord),
            end: JSON.parse(complaint.road.rEndCoord)
          };
        }
        if (complaint.segment?.sStartCoord) {
          segmentCoords = {
            start: JSON.parse(complaint.segment.sStartCoord),
            end: JSON.parse(complaint.segment.sEndCoord)
          };
        }
      } catch (e) {
        console.warn('Failed to parse coordinates:', e);
      }

      return {
        ...complaint,
        coordinates: complaint.coordinates ? JSON.parse(complaint.coordinates) : null,
        roadCoords,
        segmentCoords
      };
    });

    res.status(200).json({
      success: true,
      data: formattedComplaints
    });
  } catch (error) {
    console.error('Get assigned complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned complaints',
      error: error.message
    });
  }
};

// Get complaint details with coordinates
export const getComplaintDetails = async (req, res) => {
  try {
    const { feedbackID } = req.params;
    const { email } = req.user;

    // Get the annotator's ID from their email
    const annotator = await prisma.annotator.findUnique({
      where: { email }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    const complaint = await prisma.feedback.findUnique({
      where: { feedbackID },
      include: {
        user: {
          select: { name: true, email: true, phone: true }
        },
        road: true,
        segment: true
      }
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Only assigned annotator can view this complaint detail
    if (!complaint.assignedAnnotatorID) {
      return res.status(403).json({
        success: false,
        message: 'This complaint has not been assigned yet. Please contact admin.'
      });
    }

    if (complaint.assignedAnnotatorID !== annotator.annotatorID) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this complaint'
      });
    }

    res.status(200).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('Get complaint details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint details',
      error: error.message
    });
  }
};

// Submit label for a complaint (relabeling)
export const submitComplaintLabel = async (req, res) => {
  try {
    const { email } = req.user;
    const { feedbackID, segmentID, labelData, annotatorRemarks } = req.body;

    if (!feedbackID || !segmentID || !labelData) {
      return res.status(400).json({
        success: false,
        message: 'Feedback ID, segment ID, and label data are required'
      });
    }

    // Get annotator
    const annotator = await prisma.annotator.findUnique({
      where: { email }
    });

    if (!annotator) {
      return res.status(404).json({
        success: false,
        message: 'Annotator not found'
      });
    }

    // Get feedback to verify assignment
    const feedback = await prisma.feedback.findUnique({
      where: { feedbackID },
      include: { 
        segment: { include: { road: true } },
        road: true,
        user: { select: { email: true, name: true } }
      }
    });

    // Get new segment info (the one being labeled) for road name
    const newSegment = await prisma.roadSegment.findUnique({
      where: { segmentID },
      include: { road: true }
    });

    // Determine road name from: new segment > feedback's road > feedback's segment > default
    const roadName = newSegment?.road?.roadName || feedback?.road?.roadName || feedback?.segment?.road?.roadName || 'Unknown Road';

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Complaint feedback not found'
      });
    }

    // Allow submission if: (1) not assigned, or (2) assigned to current user
    // This enables annotators to address unassigned complaints
    if (feedback.assignedAnnotatorID && feedback.assignedAnnotatorID !== annotator.annotatorID) {
      return res.status(403).json({
        success: false,
        message: `This complaint is assigned to another annotator`
      });
    }

    // Parse coordinates from feedback
    let coordinates = { lat: null, lng: null };
    try {
      coordinates = JSON.parse(feedback.coordinates);
    } catch (e) {
      // Use default if parsing fails
    }

    // Create new label
    const label = await prisma.label.create({
      data: {
        segmentID,
        annotatorID: annotator.annotatorID,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        isVerified: false
      }
    });

    // Create roadside, intersection, speed entries if provided
    if (labelData.roadside) {
      await prisma.roadside.create({
        data: {
          labelID: label.labelID,
          leftObject: labelData.roadside.leftObject,
          rightObject: labelData.roadside.rightObject,
          distanceObject: labelData.roadside.distanceObject
        }
      });
    }

    if (labelData.intersection) {
      await prisma.intersection.create({
        data: {
          labelID: label.labelID,
          type: labelData.intersection.type,
          quality: labelData.intersection.quality,
          channelisation: labelData.intersection.channelisation
        }
      });
    }

    if (labelData.speed) {
      await prisma.speed.create({
        data: {
          labelID: label.labelID,
          speedLimit: labelData.speed.speedLimit,
          management: labelData.speed.management
        }
      });
    }

    // Create label review entry (pending admin approval) with feedbackID in remarks for tracking
    await prisma.labelReview.create({
      data: {
        labelID: label.labelID,
        status: 'PENDING',
        remarks: JSON.stringify({ feedbackID, isComplaintRelabel: true })
      }
    });

    // Update feedback with annotator remarks and link to label
    await prisma.feedback.update({
      where: { feedbackID },
      data: {
        annotatorRemarks: annotatorRemarks || null
      }
    });

    // Notify admins about the new label for review
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' }
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          email: admin.email,
          message: `New relabeling submitted for complaint "${feedback.title}" on ${roadName}. Awaiting review.`,
          type: 'LABEL_SUBMITTED',
          metadata: JSON.stringify({
            feedbackID,
            labelID: label.labelID,
            roadName,
            segmentID
          })
        }
      });
    }

    // Create notification for the annotator about successful complaint relabeling
    await prisma.notification.create({
      data: {
        email: annotator.email,
        message: `✓ Relabeling submitted successfully for complaint "${feedback.title}" on ${roadName}. Awaiting admin review.`,
        type: 'LABEL_SUBMITTED',
        metadata: JSON.stringify({
          feedbackID,
          labelID: label.labelID,
          roadName
        })
      }
    });

    // Create notification for the traveler (user who submitted the complaint) about relabeling progress
    if (feedback.user?.email) {
      await prisma.notification.create({
        data: {
          email: feedback.user.email,
          message: `✓ Your complaint "${feedback.title}" on ${roadName} has been relabeled and is now awaiting review. Thank you for your report!`,
          type: 'COMPLAINT_UPDATE',
          metadata: JSON.stringify({
            feedbackID,
            roadName
          })
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Label submitted for review',
      data: label
    });
  } catch (error) {
    console.error('Submit complaint label error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit label',
      error: error.message
    });
  }
};
