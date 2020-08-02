var commonLib = require( "./CommonLibrary.js" );
var mathLibrary = require( "../MathUtility.js" );
var deformerClass = require( "./DeformersDataClassDefinition.js" );

// This script uses some functions on MIT licensed library "bezier.js" by Pomax (https://pomax.github.io/bezierjs/).
var bezierJs = require( "../bezierjs/bezier.js" );


function previewBezierBuilder()
{
	this.fitBeziersToDragData = function( dragData, deformersData, info )
	{		
		var PF = new private_functions;	
		var CL = new commonLib.commonLibrary;


		PF.snapDragDataToDeformers( dragData, deformersData, info );
		
		if( !( "dragDataLength" in info ) || ( "dragDataLength" in info && ( info.snapStartPoint || info.snapEndPoint ) ) )
			info.dragDataLength = CL.getStraightPathsLength( dragData );			
		
		info.split = info.endIdx -info.startIdx;			
		var fittedBeziers = ( info.split == 1 ) ? 
			PF.fitSingleBezier( dragData, deformersData, info ):
			PF.fitMultipleBeziers( dragData, deformersData, info );
	
		// for deformers that are staying still, just use their data to represent their positions
		fittedBeziers = PF.pushStaticDeformersToPreviewBeziers( fittedBeziers, deformersData, info );	

		// construct a DeformersData class object from fittedBeziers
		var previewBeziers = new deformerClass.DeformersData( fittedBeziers, info.isClosed );


//----------------------------------------------- Start applying options ----------------------------------------------->
		
		// round corners
		if( previewBeziers.pathCount() > 1 )
			previewBeziers = PF.smoothBezierJoints( previewBeziers, info );

		// modify each bezier handle's length to maintain the proportion of the original
		if( info.keepProportion )
		{
			var startBz = ( info.includeAllPointsAtStart || ( !info.isClosed && info.startIdx == 0 )) ?
				info.startIdx : info.startIdx -1;
			var endBz = ( info.includeAllPointsAtEnd || ( !info.isClosed && info.endIdx == deformersData.pathCount() )) ?
				info.endIdx : info.endIdx +1;
				
			for( var bz = startBz; bz < endBz; bz++ )	
				PF.adjustHandlesProportionally( previewBeziers, deformersData, bz, info );
		}
		else if( !info.includeAllPointsAtStart && ( info.isClosed || ( !info.isClosed && info.startIdx > 0 )))	
			PF.adjustHandlesProportionally( previewBeziers, deformersData, info.startIdx -1, info );
		else if( !info.includeAllPointsAtEnd && ( info.isClosed || ( !info.isClosed && info.endIdx < deformersData.pathCount() )))
			PF.adjustHandlesProportionally( previewBeziers, deformersData, info.endIdx, info );
			
		// scale each bezier poroportionally to compensate length change
		if( info.keepLength && info.includeAllPointsAtStart && info.includeAllPointsAtEnd )
			previewBeziers = CL.compensateChangeInLength( previewBeziers, deformersData, info );
		

		//debug:
		//var lengthChange = previewBeziers.totalLength() /deformersData.totalCachedLength() *100;
		//MessageLog.trace( lengthChange.toFixed(3) + "%" );

		return previewBeziers;
	};
}	



function private_functions()
{
	var MT = new mathLibrary.math;
	var CL = new commonLib.commonLibrary;
	var BZ = new bezierJs.bezier_lib;

	this.snapDragDataToDeformers = function( dragData, deformersData, info )
	{
		/*
		 * point a == dragData's start point
		 * point b == dragData's end point
		 * point aPrime == deformer chain's start point that a snaps to
		 * point bPrime == deformer chain's end point that b snaps to
		 */ 
		var a = dragData[0];	
		var b = dragData[dragData.length -1];
		
		if( info.snapStartPoint )
		{
			// snap start point of beziers to that of deformers
			var aPrime = Point2d( deformersData.idx(info.startIdx).p0().x, deformersData.idx(info.startIdx).p0().y );
			
			// in case closed point on envelope is snapped, end point also needs to be snapped to aPrime
			if( info.editWholeCircle )
			{
				dragData[0].x = aPrime.x;
				dragData[0].y = aPrime.y;		
				dragData[dragData.length -1].x = aPrime.x;
				dragData[dragData.length -1].y = aPrime.y;
				return;
			}
		}
		else
			var aPrime = a;

		if( info.snapEndPoint )
		{
			// snap end point of beziers to that of deformers		
			var bPrime = Point2d( deformersData.idx(info.endIdx).p0().x, deformersData.idx(info.endIdx).p0().y );

			// in case closed point on envelope is snapped, start point also needs to be snapped to bPrime
			if( info.editWholeCircle )
			{
				dragData[dragData.length -1].x = bPrime.x;
				dragData[dragData.length -1].y = bPrime.y;
				dragData[0].x = bPrime.x;
				dragData[0].y = bPrime.y;			
				return;
			}
		}
		else
			var bPrime = b;
			
		// strain dragData's mid points across aPrime and bPrime. path by reference
		this.strain( dragData, a, b, aPrime, bPrime );
	};
	
	
	this.strain = function( points, a, b, aPrime, bPrime )
	{
		// snap start point to aPrime and end point to bPrime
		points[0].x = aPrime.x;
		points[0].y = aPrime.y;		
		points[points.length -1].x = bPrime.x;
		points[points.length -1].y = bPrime.y;		
		
		// 1) set line aPrime-bPrime as U-axis and V as U's normal axis, then
		// 2) rotate all mid-points based on U-axis's inclination so mid-points' XY-axis is aligned with the UV-field.
		var inclineU = MT.inclinationOf( a, b );
		var inclineU_prime = MT.inclinationOf( aPrime, bPrime );
		
		// get scale value in U-axis
		var distU = MT.distanceOf( a, b );
		var distU_prime = MT.distanceOf( aPrime, bPrime );
		var scaleU = distU_prime /distU;	
	
		for( var pt = 1; pt < points.length -1; pt++ )
		{
			var midPt = Point2d( points[pt].x, points[pt].y );
			midPt = MT.rotatedPointOf( a, midPt, -inclineU );				
	
			var a_midPt_dist = MT.subtractBFromA( midPt, a );
			var aPrime_midPt_dist = Point2d( a_midPt_dist.x *scaleU, a_midPt_dist.y );	
			
			var midPtPrime = MT.sumOf( aPrime_midPt_dist, aPrime );
			midPtPrime = MT.rotatedPointOf( aPrime, midPtPrime, inclineU_prime );

			points[pt].x = midPtPrime.x;
			points[pt].y = midPtPrime.y;
		}
	};
	
	
	this.fitSingleBezier = function( dragData, deformersData, info )
	{
		if( info.keepLength && !info.editWholeCircle && !( info.snapStartPoint && info.snapEndPoint ) )
			var splitDragData = this.trimAtDeformerLength( dragData, deformersData, info );
		else
			var splitDragData = [ dragData ];
		
		// Drawing.geometry.fit() has cap to process below decimal values. Use tool unit for fitting operation
		var splitDragData_tool = CL.convertDragDataToToolUnit( splitDragData[0] );
		var pointsToFit = { oneBezier: true, path: splitDragData_tool };
		var fittedBezier_tool = Drawing.geometry.fit( pointsToFit );
		return [ CL.convertBezierToOGLUnit( fittedBezier_tool ) ];
	};
	
	
	this.fitMultipleBeziers = function( dragData, deformersData, info )
	{
		var fittedBeziers = [];
	
		// If length constraint is turned on, fit beziers into dragData that is split at the length of each deformer
		if( info.keepLength && !info.editWholeCircle && !( info.snapStartPoint && info.snapEndPoint ) )
		{
			var splitDragData = this.trimAtDeformerLength( dragData, deformersData, info );			
			for( var sp = 0; sp < splitDragData.length; sp++ )
			{
				// Drawing.geometry.fit() has cap to process below decimal values. Use tool unit for fitting operation
				var splitDragData_tool = CL.convertDragDataToToolUnit( splitDragData[sp] );
				var pointsToFit = { oneBezier: true, path: splitDragData_tool };	
				var fitted_tool = Drawing.geometry.fit( pointsToFit );
				fittedBeziers.push( CL.convertBezierToOGLUnit( fitted_tool ) );
			}
		}
		// Fit beziers into equally split dragData.
		// If a corner is located near by a point of split, start the bezier from the corner instead.
		else
		{
			var segmentLengths = [];
			if( info.keepProportion )
			{
				var OGselectedPortionLength = 0;
				for( var pt = info.startIdx; pt < info.endIdx; pt++ )
					OGselectedPortionLength += deformersData.idx(pt).cachedLength();
				
				for( var df = info.startIdx; df < info.endIdx; df++ )
				{
					var segmentRatio = ( OGselectedPortionLength > 0 ) ? deformersData.idx(df).cachedLength() /OGselectedPortionLength : 0;
					segmentLengths.push( info.dragDataLength *segmentRatio );
				}
			}
			else
			{
				var segmentLength = info.dragDataLength /info.split;
				for( var sl = 0; sl < info.split; sl++ )
					segmentLengths.push( segmentLength );
			}			
			
			var splitDragData = this.splitAtProportionalLength( dragData, segmentLengths, info.split );
			dragData = splitDragData.path;
			
			var corners = {}; corners.idx = [];
			if( info.maxCornerAngle < 180 )
				this.findCornersFromDragData( dragData, corners, info );

			var lastSplitIdx = 0;
			for( var sp = 0; sp < info.split; sp++ )
			{		
				if( sp == info.split -1 )
					var curSplit = dragData.slice( lastSplitIdx, dragData.length );	
				else
				{
					var maxDistToCorner = segmentLengths[sp] *0.5;
					if( corners.idx.length > 0 && info.onCorner )
						var pointToFit = this.findClosestCornerToFit( splitDragData.pointIdx[sp], dragData, corners, maxDistToCorner );						
					else if( corners.idx.length > 0 && info.avoidCorner )
						var pointToFit = this.avoidCornersFromFit( splitDragData.pointIdx[sp], dragData, corners, maxDistToCorner );								
					if( corners.idx.length == 0 || pointToFit == null )
					{
						var curSplit = dragData.slice( lastSplitIdx, splitDragData.pointIdx[sp] +1 );
						lastSplitIdx = splitDragData.pointIdx[sp];
					}						
					else
					{						
						var curSplit = dragData.slice( lastSplitIdx, pointToFit +1 );
						lastSplitIdx = pointToFit;	
					}
				}
				// Drawing.geometry.fit() has cap to process below decimal values. Use tool unit for fitting operation
				var curSplit_tool = CL.convertDragDataToToolUnit( curSplit );			
				var pointsToFit = { oneBezier: true, path: curSplit_tool };	
				var fitted_tool = Drawing.geometry.fit( pointsToFit );	
				fittedBeziers.push( CL.convertBezierToOGLUnit( fitted_tool ) );
			}
		}
		return fittedBeziers;
	};
	
	
	this.findCornersFromDragData = function( dragData, corners, info )
	{
		corners.angle = [];	
		var lastIncline = MT.inclinationOf( dragData[0], dragData[1] );		
		for( var pt = 1; pt < dragData.length -1; pt++ )
		{
			var curIncline = MT.inclinationOf( dragData[pt], dragData[pt +1] );
			if( Math.abs( lastIncline -curIncline ) > 180 -info.maxCornerAngle )
			{			
				corners.idx.push( pt );
				corners.angle.push( Math.abs( lastIncline -curIncline ) );
			}			
			lastIncline = curIncline;
		}
	};
	
	
	this.findClosestCornerToFit = function( startIdx, dragData, corners, maxDistToCorner )
	{	
		// find corner by traversing adjacent points in reverse
		var dist1 = 0;
		var test1Idx = null;
		for( var pt1 = startIdx; pt1 >= 1; pt1-- )
		{
			var idxInCorners = corners.idx.indexOf( pt1 );
			if( idxInCorners !== -1 )
			{
				test1Idx = idxInCorners;
				break;
			}			
			dist1 += MT.distanceOf( dragData[ pt1 ], dragData[ pt1 -1 ] );
			if( dist1 > maxDistToCorner )
				break;
		}
		// find corner by traversing adjacent points in order
		var dist2 = 0;
		var test2Idx = null;
		var startIdx2 = startIdx +1;
		for( var pt2 = startIdx2; pt2 < dragData.length -1; pt2++ )
		{
			var idxInCorners = corners.idx.indexOf( pt2 );
			if( idxInCorners !== -1 )
			{
				test2Idx = idxInCorners;
				break;
			}			
			dist2 += MT.distanceOf( dragData[ pt2 ], dragData[ pt2 +1 ] );
			if( dist2 > maxDistToCorner )
				break;
		}
		
		if( test1Idx == null && test2Idx == null )
			return null;
		else if( test1Idx !== null && test2Idx == null )
			return corners.idx[ test1Idx ];
		else if( test1Idx == null && test2Idx !== null )
			return corners.idx[ test2Idx ];	
		else if( test1Idx !== null && test2Idx !== null )
			return ( corners.angle[ test1Idx ] > corners.angle[ test2Idx ] ) ? corners.idx[ test1Idx ]: corners.idx[ test2Idx ];		
	};
	
	
	this.avoidCornersFromFit = function( startIdx, dragData, corners, maxDistToCorner )
	{	
		// find none-corner point by traversing adjacent points in reverse
		var dist1 = 0;
		for( var pt1 = startIdx; pt1 >= 1; pt1-- )
		{
			if( corners.idx.indexOf( pt1 ) == -1 )
				return pt1;
			
			dist1 += MT.distanceOf( dragData[ pt1 ], dragData[ pt1 -1 ] );
			if( dist1 > maxDistToCorner )
				break;
		}
		// find corner by traversing adjacent points in order
		var dist2 = 0;
		var startIdx2 = startIdx +1;
		for( var pt2 = startIdx2; pt2 < dragData.length -1; pt2++ )
		{
			if( corners.idx.indexOf( pt2 ) == -1 )
				return pt2;
			
			dist2 += MT.distanceOf( dragData[ pt2 ], dragData[ pt2 +1 ] );
			if( dist2 > maxDistToCorner )
				return startIdx;
		}
	};
	

	this.trimAtDeformerLength = function( dragData, deformersData, info )
	{
		// Split dragData to match each deformer's length. New points will be inserted on dragData
		// where deformers are joined. Each new point becomes the start point for the next iteration.
		
		// If only end point is snapped, we need to calcurate split from the end point
		var trimReversed = ( !info.snapStartPoint && info.snapEndPoint );		
		if( trimReversed )
			dragData = dragData.reverse();
		
		var dragDataEndPoint = dragData[dragData.length -1];
		var splitDragData = [];
		var splitPointIdx = 0;
		var extendDragData = false;
		
		if( trimReversed )
			for( var df = info.endIdx-1; df >= info.startIdx; df-- )
				trim();
		else
			for( var df = info.startIdx; df < info.endIdx; df++ )		
				trim();
		
		function trim()
		{	
			var curDeformerLength = deformersData.idx(df).cachedLength();
			var splitSegment = [];
			var sumDragSegmentLength = 0;
			
			if( !extendDragData )
			{
				for( var sp = splitPointIdx; sp < dragData.length -1; sp++ )
				{
					var segmentLength = MT.distanceOf( dragData[sp], dragData[sp +1] );
					sumDragSegmentLength += segmentLength;
					if( sumDragSegmentLength >= curDeformerLength )
					{
						if( sumDragSegmentLength > curDeformerLength )
						{
							var pointRatio = ( segmentLength -( sumDragSegmentLength -curDeformerLength ) ) /segmentLength;			
							var splitPoint = MT.midPointAt( dragData[sp], dragData[sp +1], pointRatio );						
							dragData.splice( sp +1, 0, { x: splitPoint.x, y: splitPoint.y, "onCurve": true } );
						}					
						splitSegment = dragData.slice( splitPointIdx, sp +2 );						
						splitPointIdx = sp +1;
						break;
					}
					else if( sp == dragData.length -2 && sumDragSegmentLength < curDeformerLength )
					{
						extendDragData = true;
						break;
					}
				}
			}	
			// if drag data is shorter than sum of deformer length,
			// we need to extend the drag data for the remaining deformers
			if( extendDragData )
			{
				var endPoint = Point2d( dragData[dragData.length -1].x, dragData[dragData.length -1].y );
				var secondToEnd = Point2d( dragData[dragData.length -2].x, dragData[dragData.length -2].y );
				var lastSegmentLength = MT.distanceOf( secondToEnd, endPoint );
				
				var endVector = Vector2d( endPoint.x -secondToEnd.x, endPoint.y -secondToEnd.y );	
				var extentionLength = curDeformerLength -sumDragSegmentLength +lastSegmentLength;				
				var scaleFactor = extentionLength /lastSegmentLength;		
				
				var extendedPointX = endVector.x *scaleFactor + secondToEnd.x;
				var extendedPointY = endVector.y *scaleFactor + secondToEnd.y;				
				dragData.push( { x: extendedPointX, y: extendedPointY, "onCurve": true } );
				splitSegment = dragData.slice( splitPointIdx, dragData.length );				
				splitPointIdx = dragData.length -1;
			}
			if( trimReversed )
				splitDragData.push( splitSegment.reverse() );
			else
				splitDragData.push( splitSegment );
		}
		return ( trimReversed ) ? splitDragData.reverse() : splitDragData;			
	};
	
	
	this.splitAtProportionalLength = function( dragData, segmentLengths, split )
	{
		// Split dragData to match each deformer's length. New points will be inserted on dragData
		// where deformers are joined. Each new point becomes the start point for the next iteration.
		var splitDragData = {};
		splitDragData.pointIdx = [];
		
		var splitPointIdx = 0;
		for( var n = 0; n < split -1; n++ )
		{
			var sumDragSegmentLength = 0;			
			for( var sp = splitPointIdx; sp < dragData.length -1; sp++ )
			{
				var dragSegmentLength = MT.distanceOf( dragData[sp], dragData[sp +1] );
				sumDragSegmentLength += dragSegmentLength;
				if( sumDragSegmentLength >= segmentLengths[n] )
				{
					if( sumDragSegmentLength > segmentLengths[n] )
					{
						var pointRatio = ( dragSegmentLength -( sumDragSegmentLength -segmentLengths[n] ) ) /dragSegmentLength;			
						var splitPoint = MT.midPointAt( dragData[sp], dragData[sp +1], pointRatio );
						dragData.splice( sp +1, 0, { x: splitPoint.x, y: splitPoint.y, "onCurve": true } );
					}					
					splitDragData.pointIdx.push( sp +1 );
					splitPointIdx = sp +1;
					break;
				}
			}
		}
		splitDragData.path = dragData;
		return splitDragData;
	};
	
	
	this.smoothBezierJoints = function( previewBeziers, info )
	{
		// This function creates G1 continuity between joined beziers by simply making the 2 handles at the joint to line up.
		// Parse 2 consecutive beziers that shares a joint while the "corner" at the joint is below the tolerance angle.
		
		// if editing entire envelope deformer, smooth the Offset at the end
		if( info.editWholeCircle )
		{
			var loopStart = info.startIdx;
			var loopEnd = info.endIdx;
		}
		// if roundSnappedCorner is turned on, include snapped points at start and end
		else if( info.roundSnappedCorner )
		{
			var loopStart = ( info.snapStartPoint && ( info.isClosed || ( !info.isClosed && info.startIdx > 0 ))) ?
				info.startIdx : info.startIdx +1;	
			var loopEnd = ( info.snapEndPoint && ( info.isClosed || ( !info.isClosed && info.endIdx < previewBeziers.pathCount() ))) ?
				info.endIdx +1 : info.endIdx;
		}
		else
		{
			var loopStart = info.startIdx +1;
			var loopEnd = info.endIdx -1;
		}			

		for( var bz = loopStart; bz < loopEnd; bz++ )
		{
			var handle1Idx = bz -1;
			var jointIdx = bz;
			var handle0Idx = bz;
							
			var handle1Angle = MT.inclinationOf( previewBeziers.idx(jointIdx).p0(), previewBeziers.idx(handle1Idx).p3() );
			var handle0Angle = MT.inclinationOf( previewBeziers.idx(jointIdx).p0(), previewBeziers.idx(handle0Idx).p2() );					
			var cornerAngle = Math.abs( handle1Angle -handle0Angle );	
			if( cornerAngle > 180 )
				cornerAngle = 360 -cornerAngle;
	
			if( cornerAngle > info.maxCornerAngle )
			{				
				// line up the 2 handles that starting at the joint while maintaining their lengths		
				var joint = previewBeziers.idx(jointIdx).p0();
				var normalAngle = ( handle1Angle + handle0Angle ) /2;
				var handle1Angle_prime = ( handle1Angle > handle0Angle ) ? normalAngle +90 : normalAngle -90;
				var handle0Angle_prime = ( handle0Angle > handle1Angle ) ? normalAngle +90 : normalAngle -90;
				
				var handle1Length = MT.distanceOf( previewBeziers.idx(jointIdx).p0(), previewBeziers.idx(handle1Idx).p3() );
				var handle1_prime = MT.sumOf( MT.newPointOf( handle1Length, handle1Angle_prime ), joint );				
				previewBeziers.idx(handle1Idx).setP3( handle1_prime.x, handle1_prime.y );				
									
				var handle0Length = MT.distanceOf( previewBeziers.idx(jointIdx).p0(), previewBeziers.idx(handle0Idx).p2() );
				var handle0_prime = MT.sumOf( MT.newPointOf( handle0Length, handle0Angle_prime ), joint );				
				previewBeziers.idx(handle0Idx).setP2( handle0_prime.x, handle0_prime.y );	
			}
		}
		return previewBeziers;		
	};
	
	
	this.splitPathForDeformationStructure = function( fittedBeziers, info )
	{
		var numBez = fittedBeziers.length;
		for( var bz = 0; bz < numBez; bz++ )
		{	
			if( bz == 0 && info.startIdx == 0 )
				var firstItem = fittedBeziers[bz].shift();	
			else
				fittedBeziers[bz].shift();				
		}
		if( info.startIdx == 0 )
			fittedBeziers.unshift( [ {}, {}, firstItem ] );
		
		return fittedBeziers;
	};
	
	
	this.pushStaticDeformersToPreviewBeziers = function( fittedBeziers, deformersData, info )
	{
		if( info.startIdx > 0 )
		{
			var bez = [];
			for( var df = 0; df < info.startIdx; df++ )
			{
				var path = [];
				path.push( { x: deformersData.idx(df).p0().x, y: deformersData.idx(df).p0().y } );	
				path.push( { x: deformersData.idx(df).p2().x, y: deformersData.idx(df).p2().y } );
				path.push( { x: deformersData.idx(df).p3().x, y: deformersData.idx(df).p3().y } );	
				path.push( { x: deformersData.idx(df).p1().x, y: deformersData.idx(df).p1().y } );							
				bez.push( path );
			}
			fittedBeziers = bez.concat( fittedBeziers );
		}
		var loopEnd = ( info.isClosed ) ? deformersData.pathCount() : deformersData.nodeCount();
		for( var df2 = info.endIdx; df2 < loopEnd; df2++ )
		{
			var path = [];
			// on 1st loop, use fittedBeziers's last end point(p1) as p0.
			// this prevents position of the last end point getting overwritten.
			if( df2 == info.endIdx )
				path.push( { x: fittedBeziers[info.endIdx-1][3].x, y: fittedBeziers[info.endIdx-1][3].y } );
			else
				path.push( { x: deformersData.idx(df2).p0().x, y: deformersData.idx(df2).p0().y } );
			
			// skip handles when parsing the end deformer's start point since they don't exist
			if( df2 < deformersData.nodeCount()-1 )
			{
				path.push( { x: deformersData.idx(df2).p2().x, y: deformersData.idx(df2).p2().y } );
				path.push( { x: deformersData.idx(df2).p3().x, y: deformersData.idx(df2).p3().y } );
				path.push( { x: deformersData.idx(df2).p1().x, y: deformersData.idx(df2).p1().y } );				
			}
			fittedBeziers.push( path );
		}
		
		// for closed envelope, trim extra beziers at the end.
		// also create extra array for end point for the chain
		if( info.isClosed )
		{
			if( fittedBeziers.length > deformersData.pathCount() )
			{
				var overBy = fittedBeziers.length -deformersData.pathCount();
				for( var df3 = 0; df3 < overBy; df3++ )
				{
					fittedBeziers.splice( df3, 1, fittedBeziers[ deformersData.pathCount() +df3 ] );
					if( df3 == overBy-1 )
						fittedBeziers[df3+1][0] = fittedBeziers[df3][3];
				}
				
				fittedBeziers.length = deformersData.pathCount();
			}
			else
			{
				fittedBeziers[0][0].x = fittedBeziers[ deformersData.pathCount()-1 ][3].x;
				fittedBeziers[0][0].y = fittedBeziers[ deformersData.pathCount()-1 ][3].y;					
			}

			// copy the chain's start point position to use as its end point
			fittedBeziers[ deformersData.pathCount() ] = {};
			fittedBeziers[ deformersData.pathCount() ][0] = {};			
			fittedBeziers[ deformersData.pathCount() ][0].x = fittedBeziers[0][0].x;
			fittedBeziers[ deformersData.pathCount() ][0].y = fittedBeziers[0][0].y
		}
		return fittedBeziers;
	};
	
	
	this.adjustHandlesProportionally = function( previewBeziers, deformersData, bz, info )
	{
		var OGDeformerLength = deformersData.idx(bz).cachedLength();
		var bezierLength = previewBeziers.idx(bz).curveLength();
		
		var p0 = Point2d( previewBeziers.idx(bz).p0().x, previewBeziers.idx(bz).p0().y );
		var p2 = Point2d( previewBeziers.idx(bz).p2().x, previewBeziers.idx(bz).p2().y );
		var p3 = Point2d( previewBeziers.idx(bz).p3().x, previewBeziers.idx(bz).p3().y );
		var p1 = Point2d( previewBeziers.idx(bz).p1().x, previewBeziers.idx(bz).p1().y );
		
		var OGP2Length = deformersData.idx(bz).p2Length();
		var p2Ratio = ( OGP2Length > 0 ) ? OGP2Length /OGDeformerLength : 0;
		var p0_p2_dist = MT.distanceOf( p0, p2 );				
		var p2Length = bezierLength *p2Ratio;
		var p2scaleRatio = ( p0_p2_dist > 0 ) ? p2Length /p0_p2_dist : 0;
		var p2Vector = Vector2d( p2.x -p0.x, p2.y -p0.y );
		
		previewBeziers.idx(bz).setP2( p2Vector.x *p2scaleRatio + p0.x, p2Vector.y *p2scaleRatio + p0.y );
		
		var OGP3Length = deformersData.idx(bz).p3Length();
		var p3Ratio = ( OGP3Length > 0 ) ? OGP3Length /OGDeformerLength : 0;
		var p1_p3_dist = MT.distanceOf( p1, p3 );				
		var p3Length = bezierLength *p3Ratio;
		var p3scaleRatio = ( p1_p3_dist > 0 ) ? p3Length /p1_p3_dist : 0;
		var p3Vector = Vector2d( p3.x -p1.x, p3.y -p1.y );

		previewBeziers.idx(bz).setP3( p3Vector.x *p3scaleRatio + p1.x, p3Vector.y *p3scaleRatio + p1.y );
	};
}


exports.previewBezierBuilder = previewBezierBuilder;