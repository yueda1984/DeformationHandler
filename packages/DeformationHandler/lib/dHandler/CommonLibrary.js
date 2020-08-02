var mathLibrary = require( "../MathUtility.js" );


function commonLibrary()
{
	var MT = new mathLibrary.math;
	
	
	this.drawDirectionalArrows = function( ctx, drawingMatrix, cameraViewScale, deformersData )
	{
		var matrix_inv = MT.inverseCopiedMatrix( drawingMatrix );
		var matrixScale = drawingMatrix.extractScale();
		
		// on each deformer, draw arrows that indicates the direction of stream
		var earSize = ( cameraViewScale == 0 ) ? 0.005 : 0.025 /cameraViewScale;
		earSize = ( matrixScale.x == 0 ) ? 0.005 : earSize /Math.abs( matrixScale.x );
		if( earSize < 0.005 ) earSize = 0.005;

		for( var df = 0; df < deformersData.pathCount(); df++ )
		{
		var halfPoint = Point3d( deformersData.idx(df).halfPoint().x, deformersData.idx(df).halfPoint().y, 0 );
			var arrowEar1 = MT.rotatedPointOf(	halfPoint,
												Point3d( halfPoint.x +earSize/2, halfPoint.y +earSize, 0 ),
												deformersData.idx(df).normalAngle() );
												
			var arrowEar2 = MT.rotatedPointOf( 	halfPoint,
												Point3d( halfPoint.x -earSize/2, halfPoint.y +earSize, 0 ),
												deformersData.idx(df).normalAngle() );

			halfPoint = matrix_inv.multiply( halfPoint );
			arrowEar1 = matrix_inv.multiply( arrowEar1 );
			arrowEar2 = matrix_inv.multiply( arrowEar2 );

			var arrowPoint_tool = { x: halfPoint.x *1875, y: halfPoint.y *1875 };			
			var ear1Point_tool = { x: arrowEar1.x *1875, y: arrowEar1.y *1875 };
			var ear2Point_tool = { x: arrowEar2.x *1875, y: arrowEar2.y *1875 };
			
			ctx.overlay.paths.push( { path: [ ear1Point_tool, arrowPoint_tool, ear2Point_tool ], color: ctx.green } );	
		}
	};
	
	
	this.drawSnapCircle = function( ctx, drawingMatrix, options, deformersData, mode )
	{
		var matrixScale = drawingMatrix.extractScale();
		
		// draw circle that indicates deformer points that dragData is snapped to
		var circleSize = ( options.cameraViewScale == 0 ) ? 5 : 25 /options.cameraViewScale;
		circleSize = ( matrixScale.x == 0 ) ? 5 : circleSize /Math.abs( matrixScale.x );	
		if( circleSize < 5 ) circleSize = 5;
		if( mode == "end" ) circleSize *= 1.3;

		var ptIdx = ( mode == "start" ) ? options.startIdx : options.endIdx;
		var centroid = Point3d( deformersData.idx(ptIdx).p0().x, deformersData.idx(ptIdx).p0().y, 0 );		
		var matrix_inv = MT.inverseCopiedMatrix( drawingMatrix );		
		centroid = matrix_inv.multiply( centroid );		
		var circleInfo = { x : centroid.x *1875, y : centroid.y *1875, radius : circleSize };

		if( mode == "start" )
			ctx.snapStartCircle.push.apply( ctx.snapStartCircle, Drawing.geometry.createCircle(circleInfo) );
		else // mode == "end"
			ctx.snapEndCircle.push.apply( ctx.snapEndCircle, Drawing.geometry.createCircle(circleInfo) );
	};
	
	
	this.applyDrawingMatrixToDragData = function( dragData, drawingMatrix )
	{
		var newDragData = [];
		for( var dr in dragData )
		{
			var point = drawingMatrix.multiply( Point3d( dragData[dr].x /1875, dragData[dr].y /1875, 0 ) );
			newDragData.push( { x: point.x, y: point.y } );
		}
		return newDragData;
	};
	
	
	this.convertDragDataToToolUnit = function( dragData )
	{
		var dragData_tool = [];
		for( var dr in dragData )
			dragData_tool.push( { x: dragData[dr].x *1875, y: dragData[dr].y *1875 } );
		return dragData_tool;
	};
	
	
	this.convertBezierToOGLUnit = function( bezier )
	{
		return [{ x: bezier[0].x /1875, y: bezier[0].y /1875, onCurve: true },
				{ x: bezier[1].x /1875, y: bezier[1].y /1875 },
				{ x: bezier[2].x /1875, y: bezier[2].y /1875 },
				{ x: bezier[3].x /1875, y: bezier[3].y /1875, onCurve: true }];
	};
	
	
	this.compensateChangeInLength = function( previewBeziers, deformersData, info )
	{
		var pivot = ( info.snapEndPoint ) ? previewBeziers.idx(info.endIdx).p0(): previewBeziers.idx(info.startIdx).p0();

		// scale whole circle poroportionally to compensate the entire length change
		if( info.editWholeCircle )
		{				
			var sumBezierLength = previewBeziers.totalLength();
			var scaleFactor = ( sumBezierLength > 0 ) ? deformersData.totalCachedLength() /sumBezierLength : 0;

			for( var bz = info.startIdx; bz < info.endIdx; bz++ )
			{
				for( var pt = 0; pt < 3; pt++ )
				{	
					if( bz == info.endIdx && ( pt == 1 || pt == 2 ) )// skip for end point's handles
						continue;		
					
					switch( pt )
					{
						case 0 : var vector = Vector2d( previewBeziers.idx(bz).p0().x -pivot.x, previewBeziers.idx(bz).p0().y -pivot.y );
								 previewBeziers.idx(bz).setP0( vector.x *scaleFactor + pivot.x, vector.y *scaleFactor + pivot.y ); break;
								 
						case 1 : var vector = Vector2d( previewBeziers.idx(bz).p2().x -pivot.x, previewBeziers.idx(bz).p2().y -pivot.y );
								 previewBeziers.idx(bz).setP2( vector.x *scaleFactor + pivot.x, vector.y *scaleFactor + pivot.y ); break;
								 
						case 2 : var vector = Vector2d( previewBeziers.idx(bz).p3().x -pivot.x, previewBeziers.idx(bz).p3().y -pivot.y );
								 previewBeziers.idx(bz).setP3( vector.x *scaleFactor + pivot.x, vector.y *scaleFactor + pivot.y );
					}
				}
			}
		}
		// One by one, check length change of bezier then scale. On each loop, start point will be shifted
		// The shift amount is accumulated on each loop and then applied to the next bezier
		else
		{	
			// make a list of all bezier length before they get mutated by loops
			var bezLengthHistory = {};
			for( var bh = info.startIdx; bh < info.endIdx; bh++ )		
				bezLengthHistory[bh] = previewBeziers.idx(bh).curveLength();
			
			var accumShift = Point2d();
			
			// skip end deformer's control's point as its not scalable
			if( info.snapEndPoint && info.endIdx == deformersData.pathCount() )
				for( var bz = info.endIdx-1; bz >= info.startIdx; bz-- )
					 parsePoints();						
			if( info.snapEndPoint )
				for( var bz = info.endIdx; bz >= info.startIdx; bz-- )
					 parsePoints();
			else
				for( var bz = info.startIdx; bz <= info.endIdx; bz++ )
					 parsePoints();	
	
			function parsePoints()
			{	
				var OGDeformerLength = ( bz == info.endIdx ) ? deformersData.idx(bz-1).cachedLength() : deformersData.idx(bz).cachedLength();
				var curBezLength = ( bz == info.endIdx ) ? bezLengthHistory[bz-1] : bezLengthHistory[bz];
				var scaleFactor = ( curBezLength > 0 ) ? OGDeformerLength /curBezLength : 0;

				for( var pt = 0; pt < 3; pt++ )
				{
					if( bz == info.endIdx && ( pt == 1 || pt == 2 ) )// skip for end point's handles
						continue;			
					
					switch( pt )
					{
						case 0 : var curPt = previewBeziers.idx(bz).p0(); break;
						case 1 : var curPt = previewBeziers.idx(bz).p2(); break;					
						case 2 : var curPt = previewBeziers.idx(bz).p3();				
					}
					var vector = Vector2d( curPt.x -pivot.x, curPt.y -pivot.y );				
					var curPt_prime = Point2d( 	vector.x *scaleFactor + pivot.x + accumShift.x,
												vector.y *scaleFactor + pivot.y + accumShift.y );
												
					switch( pt )
					{
						case 0 : previewBeziers.idx(bz).setP0( curPt_prime.x, curPt_prime.y ); break;
						case 1 : previewBeziers.idx(bz).setP2( curPt_prime.x, curPt_prime.y ); break;					
						case 2 : previewBeziers.idx(bz).setP3( curPt_prime.x, curPt_prime.y );			
					}
					
					if( pt == 2 && ( info.snapEndPoint || ( !info.snapEndPoint && bz < info.endIdx-1 )))
						accumShift = MT.sumOf( accumShift, MT.subtractBFromA( curPt, curPt_prime ) );
				}
			}
		}
		return previewBeziers;
	};
	
	
	this.getStraightPathsLength = function( straightPaths )
	{
		var length = 0;
		for( var pt = 0; pt < straightPaths.length -1; pt++ )
			length += MT.distanceOf( straightPaths[pt], straightPaths[pt +1] );
		return length;
	};

	
	this.getCameraViewScale = function()
	{
		var cameraViewScales = [], childWidgetCount = [];		
		var windows = QApplication.allWidgets();
		for( var w in windows )
		{
			var window = windows[w];
			if( window.objectName == "StatusBarVisibilityCtrl" )
			{			
				var childWidgets = window.children();
				for( var cw in childWidgets )
				{
					if( childWidgets[cw].toolTip == "Zoom Factor Selector" )
					{
						childWidgetCount.push( childWidgets.length );
						cameraViewScales.push( parseInt( childWidgets[cw].text ) /100 );
						if( cameraViewScales.length > 1 )
							break;		
					}
				}
				if( cameraViewScales.length > 1 )
					break;				
			}
		}
		if( cameraViewScales.length < 2 )
			var cameraViewScale = 1;
		else
			var cameraViewScale = ( childWidgetCount[0] > childWidgetCount[1] ) ? cameraViewScales[0] : cameraViewScales[1];
			
		return cameraViewScale;
	};

	
	// debug
	this.drawTestLine = function( path, argNode, colorId )
	{
		var overlayData = { drawing: { node : argNode, frame : frame.current() }, art : 2 };
		overlayData.layers = [{	shaders: [ { colorId : colorId } ],
								under: true, referenceLayer: 0,							
								strokes:
								[{ shaderLeft: 0, stroke: true,
									pencilColorId: colorId,									
									thickness: { maxThickness: 8, minThickness: 0, thicknessPath: 8 },									
									path: path
								}],}];			
		DrawingTools.createLayers( overlayData );
	};	
}


exports.commonLibrary = commonLibrary;