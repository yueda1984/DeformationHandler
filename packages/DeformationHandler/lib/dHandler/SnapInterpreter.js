var commonLib = require( "./CommonLibrary.js" );
var mathLibrary = require( "../MathUtility.js" );

function snapInterpreter()
{
	// When user draws drag data while snap start/end options are on, drag data's start/end point will be snapped to
	// a proximity point on deformes. Only deformers' control points between the snapped points will be modified.
	this.detectSnappedPoints = function( curPoint, deformersData, options, mode )
	{
		var CL = new commonLib.commonLibrary;	
		var MT = new mathLibrary.math;
		
		var snapDist = ( options.cameraViewScale == 0 ) ? 0 : options.snapDist /options.cameraViewScale *0.001;

		var isCurve = ( node.getTextAttr( deformersData.endNode(), frame.current(), "localReferential" ) == "Y" );
		var isClosed = ( !isCurve && ( node.getTextAttr( deformersData.endNode(), frame.current(), "closepath" ) == "Y" ) );
		var nodeCount = ( isClosed ) ? deformersData.pathCount() : deformersData.nodeCount();

		var ptIdx = ( mode == "start" || mode == "quickCheckStart" ) ? 0 : 1;
		options.pointByDist[ptIdx] = [];
		if( mode == "quickCheckStart" || mode == "quickCheckEnd" )
		{
			for( var dd = 0; dd < nodeCount; dd++ )
			{
				var deformerPos = Point2d( deformersData.idx(dd).p0().x, deformersData.idx(dd).p0().y )
				var curDist = MT.distanceOf( curPoint, deformerPos );
				if( curDist <= snapDist )
				{
					options.pointByDist[ptIdx].push( { dist: curDist, idx: parseInt( dd ) } );
					break;
				}
			}
		}
		else
		{
			var distHistory = [];		
			for( var dd = 0; dd < nodeCount; dd++ )
			{
				var deformerPos = Point2d( deformersData.idx(dd).p0().x, deformersData.idx(dd).p0().y )
				distHistory.push( { dist: MT.distanceOf( curPoint, deformerPos ), idx: parseInt( dd ) } );
			}
			
			while( options.pointByDist[ptIdx].length !== distHistory.length )			
			{
				var minDist = null;
				var closestPointIdx;		
				for( var dh = 0; dh < distHistory.length; dh++ )
				{
					var curDist = distHistory[dh].dist;
					if( curDist !== "spliced" && ( minDist == null || curDist <= minDist ) )
					{
						minDist = curDist;
						closestPointIdx = dh;
					}
				}
				options.pointByDist[ptIdx].push( distHistory[closestPointIdx] );
				distHistory.splice( closestPointIdx, 1, "spliced" );
			}
		}

		var maxIdx = deformersData.pathCount();

		if( mode == "start" || mode == "quickCheckStart" )
		{
			if( options.allowSnapStart && options.pointByDist[ptIdx].length > 0 )
			{
				options.snapStartPoint = ( options.pointByDist[ptIdx][0].dist <= snapDist ) ? true : false;
				options.startIdx = ( options.pointByDist[ptIdx][0].dist <= snapDist ) ? options.pointByDist[ptIdx][0].idx : 0;
			}
			else
			{
				options.snapStartPoint = false;		
				options.startIdx = 0;
			}
		}		
		else // mode == "end" || mode == "quickCheckEnd"
		{
			// on keepShape modes, only allow to snap start or end point			
			if( options.allowSnapEnd && options.pointByDist[ptIdx].length > 0 &&
			( !options.keepShape || ( options.keepShape && !options.snapStartPoint ) ) )
			{
				options.snapEndPoint = ( options.pointByDist[ptIdx][0].dist <= snapDist ) ? true : false;
				options.endIdx = ( options.pointByDist[ptIdx][0].dist <= snapDist ) ? options.pointByDist[ptIdx][0].idx : maxIdx;
			}		
			else
			{
				options.snapEndPoint = false;		
				options.endIdx = maxIdx;
			}
		}
	};
	

	this.interpretSnappedPoints = function( dragData, deformersData, info )
	{
		var PF = new private_functions;	
		var CL = new commonLib.commonLibrary;	
		var MT = new mathLibrary.math;	
		
		info.maxIdx = deformersData.pathCount();
		info.includeAllPointsAtStart = true;
		info.includeAllPointsAtEnd = true;		
		info.editWholeCircle = false;
		info.selectedSegmentPassesOffset = false;	
		
		//MessageLog.trace( "OG start idx: " + info.startIdx );
		//MessageLog.trace( "OG end idx: " + info.endIdx );

//////////////////////////////////////////////// Curve and Open Envelope ////////////////////////////////////////////////
		
		if( !info.isClosed ) 
		{	
			// turn off keepLength if both points have been snapped
			if( info.keepLength && info.snapStartPoint && info.snapEndPoint )
				info.keepLength = false;

			// Snapping start and end to the same point is not allowed.
			// Modify one of the point index to avoid the conflict:	
			PF.giveUniqueIndexToStartAndEnd( info );

			if( info.startIdx > info.endIdx )
			{
				PF.swapSnapInfo( info );
				dragData = dragData.reverse();
			}

			// On one-point snapping, choose which deformer to control by finding
			// the closest point on the deformer to the end of dragData. If user pressed Shift key,
			// however, that will automatically include all deformers starting from the snapped point.
			if( !KeyModifiers.IsShiftPressed() && deformersData.nodeCount() > 2 && (
				( !info.snapStartPoint && info.snapEndPoint ) ||
				( info.snapStartPoint && !info.snapEndPoint )
			))
			{
				//MessageLog.trace( "case1" );				
				if( info.snapStartPoint && !info.snapEndPoint )
					var isValid = PF.setClosestPoint( deformersData, dragData, info, info.pointByDist[1], info.maxIdx );
				else if( !info.snapStartPoint && info.snapEndPoint )				
					var isValid = PF.setClosestPoint( deformersData, dragData, info, info.pointByDist[0], info.maxIdx );					
				if( !isValid )
					return false;
			}
			// if user pressed Shift key or no points have been snapped while keepShape shape option is on
			else if( ( KeyModifiers.IsShiftPressed() || ( !info.snapStartPoint && !info.snapEndPoint ) ) && info.keepShape )
				info.editWholeCircle = true;
			//else
				//MessageLog.trace( "case2" );			
		}
		
//////////////////////////////////////////////////// Closed Envelope ////////////////////////////////////////////////////
		
		else if( info.isClosed && !info.keepShape )
		{
			// If deformer is closed envelope, Snapping start and end to the same point is allowed.
			// When the snapped point is not offset point, endIdx will be larger than deformersData.pathCount().
			if( ( info.snapStartPoint && info.snapEndPoint ) &&
				( info.startIdx == info.endIdx || ( info.startIdx == 0 && info.endIdx == info.maxIdx ) ) )
			{
				info.startIdx = info.endIdx;					
				info.endIdx += info.maxIdx;		
				info.editWholeCircle = true;
				info.selectedSegmentPassesOffset = true;
				//MessageLog.trace( "case3" );
			}
			// Two-point snapping in reverse direction. This switches the side of
			// control points being affected. endIdx will be larger than deformersData.pathCount().
			else if( info.startIdx > info.endIdx )			
			{
				info.keepLength = false;
				
				var reverseDragData = true;
				if( info.startIdx > info.endIdx )
				{
					PF.swapSnapInfo( info );
					var reverseDragData = false;
				}
		
				// when the list of control points being modified passes offset point
				if( info.startIdx > 0 && info.snapStartPoint && info.snapEndPoint )
				{	
					if( reverseDragData )
						dragData = dragData.reverse();	
	
					var OGStartIdx2 = info.startIdx;
					info.startIdx = info.endIdx;					
					info.endIdx += info.maxIdx -( info.endIdx -OGStartIdx2 );		
					info.selectedSegmentPassesOffset = true;
					//MessageLog.trace( "case4" );
				}
				else
				{					
					if( info.startIdx == 0 && info.endIdx < info.maxIdx )
						info.startIdx = info.maxIdx;
					else if( info.startIdx > 0 && info.endIdx == info.maxIdx )
						info.endIdx = 0;

					PF.swapSnapInfo( info );
					if( reverseDragData )
						dragData = dragData.reverse();
					//MessageLog.trace( "case5" );
				}
			}
			// regular two-point snapping
			else if( info.snapStartPoint && info.snapEndPoint )
			{
				info.keepLength = false;
				//MessageLog.trace( "case6" );
			}
			// not snapped to any points
			else if( !info.snapStartPoint && !info.snapEndPoint )
			{
				info.editWholeCircle = true;
				//MessageLog.trace( "case7" );
			}			
			// On one-point snapping, choose which deformer to control by finding
			// the closest point on the deformer to the end of dragData. If user pressed Shift key,
			// however, that will automatically include all deformers starting from the snapped point.
			else if( !KeyModifiers.IsShiftPressed() && deformersData.nodeCount() > 2 && (
				( !info.snapStartPoint && info.snapEndPoint ) ||
				( info.snapStartPoint && !info.snapEndPoint )
			))
			{
				if( info.snapStartPoint && !info.snapEndPoint )
					var isValid = PF.setClosestPoint( deformersData, dragData, info, info.pointByDist[1], deformersData.nodeCount()*2 -1 );
				else if( !info.snapStartPoint && info.snapEndPoint )	
					var isValid = PF.setClosestPoint( deformersData, dragData, info, info.pointByDist[0], info.maxIdx );	
				if( !isValid )
					return false;
			}
			//else
				//MessageLog.trace( "case12" );	
		}
		
//////////////////////////////////////// Closed Envelope with KeepShape Option ////////////////////////////////////////
		
		else if( info.isClosed && info.keepShape )
		{
			info.editWholeCircle = true;
			
			// snapping start and end to the same point is not allowed
			PF.giveUniqueIndexToStartAndEnd( info );				
			
			// when the snapped point is not offset point, endIdx will be larger than deformersData.length -1
			if( ( info.snapStartPoint && info.startIdx > 0 && info.startIdx < info.maxIdx ) ||
				( info.snapEndPoint && info.endIdx > 0 && info.endIdx < info.maxIdx ) )
			{
				if( info.snapEndPoint )
				{		
					PF.swapSnapInfo( info );
					dragData = dragData.reverse();						
				}
				info.endIdx = info.startIdx + info.maxIdx;
				info.selectedSegmentPassesOffset = true;
				//MessageLog.trace( "case13" );
			}
			else if( info.startIdx > info.endIdx )
			{
				PF.swapSnapInfo( info );
				dragData = dragData.reverse();	
				//MessageLog.trace( "case14" );
			}
			//else
				//MessageLog.trace( "case15" );
		}
		//else
			//MessageLog.trace( "case16" );			
		
		
	
		
		/*
		MessageLog.trace( "snapStart?: " + info.snapStartPoint );		
		MessageLog.trace( "start idx: " + info.startIdx );
		MessageLog.trace( "snapEnd?: " + info.snapEndPoint );		
		MessageLog.trace( "end idx: " + info.endIdx );
		MessageLog.trace( "includeAllPointsAtStart?: " + info.includeAllPointsAtStart );
		MessageLog.trace( "includeAllPointsAtEnd?: " + info.includeAllPointsAtEnd );				
		MessageLog.trace( "editWholeCircle: " + info.editWholeCircle );	
		MessageLog.trace( "selectedSegmentPassesOffset: " + info.selectedSegmentPassesOffset );
		MessageLog.trace( "keepLength?: " + info.keepLength );
		*/
		
		// when these constraint options are selected together while snapped to a point, do nothing
		if( info.keepLength && info.keepRotation && info.keepShape && ( info.snapStartPoint || info.snapEndPoint ) )
			return false;
		
		return true;
	};
}


function private_functions()
{	
	this.giveUniqueIndexToStartAndEnd = function( info )
	{
		// in case only one point is snapped, change the other point's index
		if( !info.snapStartPoint && info.snapEndPoint && info.startIdx == info.endIdx )
			info.startIdx = info.maxIdx;
		else if( info.snapStartPoint && !info.snapEndPoint && info.startIdx == info.endIdx )
		{
			if( info.endIdx == info.maxIdx )
				info.startIdx = 0;				
			else
				info.endIdx = 0;
		}
		// if the both points are snapped to the same idx, change the end point's index
		if( info.startIdx == info.endIdx )
		{	
			info.snapEndPoint = false;
			info.endIdx = ( info.startIdx == 0 ) ? info.maxIdx : 0;
		}			
	};
	
	
	this.setClosestPoint = function( deformersData, dragData, info, pointByDist, loopMax )
	{
		var CL = new commonLib.commonLibrary;
		info.dragDataLength = CL.getStraightPathsLength( dragData );
		
		// Pick the closest point from top 2 closest points by evaluating these factors:
		// 	- each point's shortest distance to the target point on dragData.
		//	- each point's length along the path to the snapped point.
		if( pointByDist.length > 1 )
		{			
			var geoDiff = [];
			for( var pd = 0; pd < 2; pd++ )
			{	
				var start = ( info.snapStartPoint ) ? info.startIdx : pointByDist[pd].idx;
				var end = ( info.snapEndPoint ) ? info.endIdx : pointByDist[pd].idx;
				
				if( start > end && info.isClosed )
					end += info.maxIdx;
				else if( start > end || start == end )
					continue;

				var geoDist = 0;
				for( var count = start; count < end; count++ )
					geoDist += deformersData.idx(count).cachedLength();

				geoDiff.push( Math.abs( info.dragDataLength -geoDist ) );
			}
		
			if( geoDiff.length > 1 )
			{
				var score0 = 1;				
				var score1 = ( pointByDist[0].dist > 0) ? 0.5 *( pointByDist[1].dist /pointByDist[0].dist ) : 0;
				score1 = ( geoDiff[0] > 0) ? score1 + 0.5 *( geoDiff[1] /geoDiff[0] ) : score1;							
				var closestIdx = ( score0 < score1 ) ? pointByDist[0].idx : pointByDist[1].idx;
			}
			else
				var closestIdx = pointByDist[0].idx;					
		}
		else
			var closestIdx = pointByDist[0].idx
	
		if( info.snapStartPoint && ( info.startIdx > closestIdx ) )
			closestIdx += info.maxIdx;
		else if( info.snapEndPoint && ( closestIdx > info.endIdx ) )
			closestIdx -= info.maxIdx;

		var snappedPointIdx = ( info.snapStartPoint ) ? info.startIdx : info.endIdx;
		

		if( closestIdx == snappedPointIdx )
		{
		if(	info.dragDataLength > deformersData.idx(0).cachedLength() )
			{
				if( info.snapStartPoint )
					closestIdx = info.maxIdx;
				else if( info.snapEndPoint )
					closestIdx = 0;					
			}
			else // dragData is too short. do nothing
				return false;
		}

		if( closestIdx < loopMax )
		{
			if( info.snapStartPoint )
			{
				info.includeAllPointsAtEnd = false;
				if( info.isClosed && info.startIdx < 0 )
				{
					//MessageLog.trace( "subCase1-2" );
					info.startIdx += info.maxIdx;								
					info.endIdx = closestIdx + info.maxIdx;	
				}				
				else
				{
					//MessageLog.trace( "subCase1-2" );
					info.endIdx = closestIdx;
				}
			}
			else
			{
				info.includeAllPointsAtStart = false;
				if( info.isClosed && closestIdx < 0 )
				{
					//MessageLog.trace( "subCase2-1" );
					info.startIdx = closestIdx + info.maxIdx;								
					info.endIdx += info.maxIdx;									
				}
				else
				{
					//MessageLog.trace( "subCase2-2" );				
					info.startIdx = closestIdx;
				}
			}
		}

		if( info.isClosed )
			info.selectedSegmentPassesOffset = ( info.maxIdx <= info.endIdx ) ? true : false;
		
		return true;
	};
	
	this.swapSnapInfo = function( info )
	{			
		var OGStartPt = info.snapStartPoint;
		var OGStartIdx = info.startIdx;
		info.snapStartPoint = info.snapEndPoint;
		info.startIdx = info.endIdx;
		info.snapEndPoint = OGStartPt;
		info.endIdx = OGStartIdx;
	};
}


exports.snapInterpreter = snapInterpreter;