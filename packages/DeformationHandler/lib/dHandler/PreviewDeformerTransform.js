var commonLib = require( "./CommonLibrary.js" );
var mathLibrary = require( "../MathUtility.js" );

// This script uses some functions on MIT licensed library "bezier.js" by Pomax (https://pomax.github.io/bezierjs/).
var bezierJs = require( "../bezierjs/bezier.js" );


function previewDeformerTransform()
{
	this.previewTransformedDeformers = function( dragData, deformersData, previewBeziers, info )
	{		
		var PF = new private_functions;	
		var CL = new commonLib.commonLibrary;
		var MT = new mathLibrary.math;

		PF.transformBeziers( previewBeziers, dragData, info );
		
		// scale each bezier poroportionally to compensate length change
		if( info.keepLength && !info.keepProportion )
			previewBeziers = CL.compensateChangeInLength( previewBeziers, deformersData, info );
		
		//debug:
		//var lengthChange = previewBeziers.totalLength() /deformersData.totalCachedLength() *100;
		//MessageLog.trace( lengthChange.toFixed(3) + "%" );	
		
		// this will be used as previewBeziers
		return previewBeziers;	
	};
}	







function private_functions()
{
	var MT = new mathLibrary.math;
	var BZ = new bezierJs.bezier_lib;
	var CL = new commonLib.commonLibrary;

	
	this.transformBeziers = function( previewBeziers, dragData, info )
	{
		/*
		 * a == bezier chain's start point
		 * b == extreme point from 'a'
		 * 	    - If defomer is open, bezier chain's end point
		 * 	    - If defomer is closed, farmost point from 'a' calcurated by tracking down the path	 
		 * aPrime == dragData's start point
		 * bPrime == dragData's end point
		 */ 		
		var a = Point2d( previewBeziers.idx(info.startIdx).p0().x, previewBeziers.idx(info.startIdx).p0().y );
		
		if( info.isClosed )
			var b = this.getExtremePointFromA( previewBeziers, info );
		else
			var b = Point2d( previewBeziers.idx(info.endIdx).p0().x, previewBeziers.idx(info.endIdx).p0().y );
		var aPrime = dragData[0];	
		var bPrime = dragData[dragData.length -1];

		// snap dragData's start and end points to that of deformers
		if( info.snapStartPoint )
			aPrime = a;
		else if( info.snapEndPoint )
			bPrime = b;

		
		if( info.keepRotation )
		{	
			if( info.isClosed )
				var inclineU = MT.inclinationOf( a, b );			
			else
			{
				var minStart = Point2d( previewBeziers.idx(0).p0().x, previewBeziers.idx(0).p0().y );
				var maxEnd = Point2d( previewBeziers.idx(previewBeziers.pathCount()).p0().x, previewBeziers.idx(previewBeziers.pathCount()).p0().y );
				var inclineU = MT.inclinationOf( minStart, maxEnd );
			}
			var inclineU_prime = inclineU;			
		}
		else
		{
			var inclineU = MT.inclinationOf( a, b );
			var inclineU_prime = MT.inclinationOf( aPrime, bPrime );
		}

		if( info.keepLength && info.keepProportion )
		{
			var scaleU = 1;
			var pivot = a;
			var pivotPrime = aPrime;				
		}
		else
		{
			var distU = MT.distanceOf( a, b );
			var distU_prime = MT.distanceOf( aPrime, bPrime );
			var scaleU = distU_prime /distU;
			var pivot = ( info.snapEndPoint || ( !info.snapStartPoint && !info.snapEndPoint ) ) ? b : a;
			var pivotPrime = ( info.snapEndPoint || ( !info.snapStartPoint && !info.snapEndPoint ) ) ? bPrime : aPrime;			
		}

		// Apply the scaling to midpoints in previewBeziers	
		for( var df = info.startIdx; df <= info.endIdx; df++ )
		{
			for( var pt = 0; pt < 3; pt++ )
			{
				// if deformer is closed, process its offset point ( end point of chain ) at the end.
				// also skip for the end deformer point's handles since they don't exist
				if( ( pt == 0 && info.isClosed && info.startIdx == 0 && df == info.startIdx ) ||
					( df == info.endIdx && ( pt == 1 || pt == 2 ) ) )
					continue;
				
				switch( pt )
				{
					case 0 : var midPt = Point2d( previewBeziers.idx(df).p0().x, previewBeziers.idx(df).p0().y ); break;
					case 1 : var midPt = Point2d( previewBeziers.idx(df).p2().x, previewBeziers.idx(df).p2().y ); break;
					case 2 : var midPt = Point2d( previewBeziers.idx(df).p3().x, previewBeziers.idx(df).p3().y );
				}	
				midPt = MT.rotatedPointOf( pivot, midPt, -inclineU );				
		
				var pivot_midPt_dist = MT.subtractBFromA( midPt, pivot );
				var pivotPrime_midPt_dist = Point2d( pivot_midPt_dist.x *scaleU, pivot_midPt_dist.y );
				
				var midPtPrime = MT.sumOf( pivotPrime_midPt_dist, pivotPrime );
				midPtPrime = MT.rotatedPointOf( pivotPrime, midPtPrime, inclineU_prime );

				switch( pt )
				{
					case 0 : previewBeziers.idx(df).setP0( midPtPrime.x, midPtPrime.y ); break;
					case 1 : previewBeziers.idx(df).setP2( midPtPrime.x, midPtPrime.y ); break;
					case 2 : previewBeziers.idx(df).setP3( midPtPrime.x, midPtPrime.y );
				}
			}
		}
	};
	
	
	this.getExtremePointFromA = function( previewBeziers, info )
	{
		var sumBezLength = 0, lengthHistory = {};
		for( var df = info.startIdx; df < info.endIdx; df++ )
		{
			sumBezLength += previewBeziers.idx(df).curveLength();
			lengthHistory[df] = sumBezLength;
		}

		var a_b_dist = sumBezLength /2;
		for( var lh = info.startIdx; lh < info.endIdx; lh++ )
			if( lengthHistory[lh] > a_b_dist )
				break;
		
		var pathToDiscretize = {
			precision: 1,
			path : [ 	{ x: previewBeziers.idx(lh).p0().x, y: previewBeziers.idx(lh).p0().y, onCurve: true },
						{ x: previewBeziers.idx(lh).p2().x, y: previewBeziers.idx(lh).p2().y },
						{ x: previewBeziers.idx(lh).p3().x, y: previewBeziers.idx(lh).p3().y },
						{ x: previewBeziers.idx(lh).p1().x, y: previewBeziers.idx(lh).p1().y, onCurve: true }
			]};			
		var splitPath = Drawing.geometry.discretize( pathToDiscretize );
				
		var sumSegmentLength = lengthHistory[lh-1];			
		for( var sp = 0; sp < splitPath.length -1; sp++ )
		{
			var segmentLength = MT.distanceOf( splitPath[sp], splitPath[sp +1] );
			sumSegmentLength += segmentLength;			
			if( sumSegmentLength == a_b_dist )
				return splitPath[sp +1];
			
			else if( sumSegmentLength > a_b_dist )
			{
				var pointRatio = ( segmentLength -( sumSegmentLength -a_b_dist ) ) /segmentLength;			
				return  MT.midPointAt( splitPath[sp], splitPath[sp +1], pointRatio );
			}					
		}
		// just in case
		var halfPointIdx = parseInt( Math.abs( info.endIdx -info.startIdx ) );
		return Point2d( previewBeziers.idx(halfPointIdx).p0().x, previewBeziers.idx(halfPointIdx).p0().y );	
	};
}


exports.previewDeformerTransform = previewDeformerTransform;