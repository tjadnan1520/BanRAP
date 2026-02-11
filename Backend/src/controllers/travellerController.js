import prisma from '../config/prisma.js';

export const getTravellerDashboard = async (req, res) => {
  try {
    const { email } = req.user;

    const traveller = await prisma.traveller.findUnique({
      where: { email },
      include: {
        user: {
          select: { name: true, phone: true, email: true }
        }
      }
    });

    if (!traveller) {
      return res.status(404).json({
        success: false,
        message: 'Traveller not found'
      });
    }

    // Get recent roads/segments for the traveller
    const recentFeedbacks = await prisma.feedback.findMany({
      where: { email },
      include: {
        road: true,
        segment: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Parse coordinates in feedbacks
    const formattedFeedbacks = recentFeedbacks.map(feedback => {
      let roadStartCoord = null;
      let roadEndCoord = null;
      let segmentStartCoord = null;
      let segmentEndCoord = null;

      try {
        if (feedback.road) {
          roadStartCoord = feedback.road.rStartCoord ? JSON.parse(feedback.road.rStartCoord) : null;
          roadEndCoord = feedback.road.rEndCoord ? JSON.parse(feedback.road.rEndCoord) : null;
        }
        if (feedback.segment) {
          segmentStartCoord = feedback.segment.sStartCoord ? JSON.parse(feedback.segment.sStartCoord) : null;
          segmentEndCoord = feedback.segment.sEndCoord ? JSON.parse(feedback.segment.sEndCoord) : null;
        }
      } catch (e) {
        console.warn(`Failed to parse coordinates for feedback ${feedback.feedbackID}:`, e);
      }

      return {
        ...feedback,
        road: feedback.road ? {
          ...feedback.road,
          rStartCoord: roadStartCoord,
          rEndCoord: roadEndCoord
        } : null,
        segment: feedback.segment ? {
          ...feedback.segment,
          sStartCoord: segmentStartCoord,
          sEndCoord: segmentEndCoord
        } : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        traveller,
        recentFeedbacks: formattedFeedbacks
      }
    });
  } catch (error) {
    console.error('Get traveller dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard',
      error: error.message
    });
  }
};

export const getTravellerMap = async (req, res) => {
  try {
    // Get all roads and segments
    const roads = await prisma.road.findMany({
      include: {
        segments: {
          include: {
            starRatings: true
          }
        }
      }
    });

    // Parse coordinates for all roads and segments
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

    res.status(200).json({
      success: true,
      data: formattedRoads
    });
  } catch (error) {
    console.error('Get traveller map error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch map data',
      error: error.message
    });
  }
};

export const getTravellerRoute = async (req, res) => {
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
        starRatings: {
          include: {
            navigationRoutes: true
          }
        },
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
    console.error('Get traveller route error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch route',
      error: error.message
    });
  }
};

export const submitTravellerFeedback = async (req, res) => {
  try {
    const { email } = req.user;
    const { title, description, imageURL, coordinates, segmentID, roadID, feedbackType, location } = req.body;

    console.log('Feedback submission payload:', { title, description, coordinates, segmentID, roadID, feedbackType, location });

    // Validate required fields - only description and coordinates are mandatory
    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    if (!coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates are required'
      });
    }

    // Ensure coordinates has lat and lng
    if (!coordinates.lat || !coordinates.lng) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates must have lat and lng properties'
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

    // Generate title if not provided
    let finalTitle = title;
    if (!finalTitle) {
      finalTitle = location || `Road Report at ${parseFloat(coordinates.lat).toFixed(4)}, ${parseFloat(coordinates.lng).toFixed(4)}`;
    }

    // Try to find nearest road/segment if not provided
    let foundRoadID = roadID || null;
    let foundSegmentID = segmentID || null;

    if (!foundSegmentID && coordinates) {
      // Optionally: Find nearest segment based on coordinates
      // For now, we'll leave it null to allow reports on any location
      console.log('No segment provided - user reporting on custom location or unmapped area');
    }

    const feedbackData = {
      title: finalTitle,
      description,
      imageURL: imageURL || null,
      coordinates: JSON.stringify(coordinates),
      status: 'PENDING',
      feedbackType: feedbackType || 'COMPLAINT',
      email,
      segmentID: foundSegmentID,
      roadID: foundRoadID
    };

    console.log('Creating feedback with data:', feedbackData);

    const feedback = await prisma.feedback.create({
      data: feedbackData
    });

    console.log('Feedback created successfully:', feedback.feedbackID);

    // Create notification for admins with location info
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' }
    });

    const locationInfo = foundSegmentID 
      ? `road segment ${foundSegmentID}` 
      : `location (${parseFloat(coordinates.lat).toFixed(4)}, ${parseFloat(coordinates.lng).toFixed(4)})`;

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          email: admin.email,
          message: `New complaint from traveller: "${description.substring(0, 50)}..." at ${locationInfo}. Status: Pending assignment.`,
          type: 'FEEDBACK'
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully! Admin will review and assign an analyst.',
      data: feedback
    });
  } catch (error) {
    console.error('Submit traveller feedback error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reference in complaint data. Please ensure all references are valid.',
        error: error.message
      });
    }
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate complaint detected',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit complaint',
      error: error.message
    });
  }
};

export const getTravellerNotifications = async (req, res) => {
  try {
    const { email } = req.user;

    const notifications = await prisma.notification.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.status(200).json({
      success: true,
      data: notifications
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

// Get traveller's complaint history
export const getMyComplaints = async (req, res) => {
  try {
    const { email } = req.user;

    const complaints = await prisma.feedback.findMany({
      where: { email },
      include: {
        road: true,
        segment: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: complaints
    });
  } catch (error) {
    console.error('Get my complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: error.message
    });
  }
};

// Get all roads and segments for complaint submission (with map data)
export const getRoadsForFeedback = async (req, res) => {
  try {
    const roads = await prisma.road.findMany({
      include: {
        segments: {
          select: {
            segmentID: true,
            sStartCoord: true,
            sEndCoord: true
          }
        }
      }
    });

    // Format roads with parsed coordinates for map display
    const formattedRoads = roads.map(road => {
      let startCoord = null;
      let endCoord = null;
      
      try {
        startCoord = JSON.parse(road.rStartCoord);
        endCoord = JSON.parse(road.rEndCoord);
      } catch (e) {
        // Ignore parsing errors
      }

      return {
        roadID: road.roadID,
        roadName: road.roadName,
        startCoord,
        endCoord,
        segments: road.segments.map((segment, index) => {
          let segStartCoord = null;
          let segEndCoord = null;
          
          try {
            segStartCoord = JSON.parse(segment.sStartCoord);
            segEndCoord = JSON.parse(segment.sEndCoord);
          } catch (e) {
            // Ignore parsing errors
          }

          return {
            segmentID: segment.segmentID,
            segmentName: `Segment ${index + 1}`,
            startCoord: segStartCoord,
            endCoord: segEndCoord
          };
        })
      };
    });

    res.status(200).json({
      success: true,
      data: formattedRoads
    });
  } catch (error) {
    console.error('Get roads for feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roads',
      error: error.message
    });
  }
};
