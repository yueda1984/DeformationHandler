var mathLibrary = require( "../MathUtility.js" );
var deformPickup = require( "./DeformationPickup.js" );
var snapInterpret = require( "./SnapInterpreter.js" );
var bezierBuild = require( "./PreviewBezierBuilder.js" );
var deformerTransform = require( "./PreviewDeformerTransform.js" );
var deformerClass = require( "./DeformersDataClassDefinition.js" );

// This script uses some functions on MIT licensed library "bezier.js" by Pomax (https://pomax.github.io/bezierjs/).
var bezierJs = require( "../bezierjs/bezier.js" );


function deformationSetter()
{
	this.updateDeformers = function( dragData, deformersData, options )
	{
		var PF = new private_functions;
		var DP = new deformPickup.deformationPickup;
		var SI = new snapInterpret.snapInterpreter;
		var BB = new bezierBuild.previewBezierBuilder;
		var DT = new deformerTransform.previewDeformerTransform;
		var fr = frame.current();
		
		var info = JSON.parse( JSON.stringify( options ) );		
		info.isCurve = ( node.getTextAttr( deformersData.endNode(), fr, "localReferential" ) == "Y" );
		info.isClosed = ( !info.isCurve && ( node.getTextAttr( deformersData.endNode(), fr, "closepath" ) == "Y" ) );
		SI.detectSnappedPoints( dragData[0], deformersData, info, "start" );	
		SI.detectSnappedPoints( dragData[dragData.length-1], deformersData, info, "end" );
		
		// this function will add infomation of snapped points to info. this may modify dragData if its order needs to be reversed		
		var isValid = SI.interpretSnappedPoints( dragData, deformersData, info );
		if( !isValid )
			return deformersData;

		var deformersData_copy = new deformerClass.DeformersData( deformersData, deformersData.isClosed() );
		var previewBeziers = ( options.keepShape ) ?
			DT.previewTransformedDeformers( dragData, deformersData, deformersData_copy, info ):
			BB.fitBeziersToDragData( dragData, deformersData_copy, info );
		
		var valuesToSet = ( info.isCurve ) ?
			PF.translateValuesForCurve( previewBeziers, deformersData, fr, info ):
			PF.translateValuesForEnvelope( previewBeziers, deformersData, fr, info );


		scene.beginUndoRedoAccum( "Deformation Handler: Control deformers" );
		PF.setOffsetAndCurve( deformersData, fr, valuesToSet, info );		
		scene.endUndoRedoAccum();

		// update deformersData for re-drawing directional arrows
		return DP.getDeformersData( deformersData.nodeList(), deformersData.switchNode(), fr );
	};
	
	
	this.resetDeformers = function( dragData, deformersData )
	{
		var PF = new private_functions;
		var DP = new deformPickup.deformationPickup;
		var fr = frame.current();
		
		scene.beginUndoRedoAccum( "Deformation Handler: Reset deformers" );
		for( var df = 0; df < deformersData.nodeCount(); df++ )
			if( PF.boolPointIsInPoly( deformersData.idx(df).p0(), dragData ) )
			{
				var curNode = ( df < deformersData.nodeCount() -1 ) ?
					deformersData.idx(df).node() : deformersData.endNode();
				PF.applyRestingValues( curNode, fr );
			}
		scene.endUndoRedoAccum();

		// update deformersData for re-drawing directional arrows	
		return DP.getDeformersData( deformersData.nodeList(), deformersData.switchNode(), fr );
	};
}




function private_functions()
{
	var MT = new mathLibrary.math;
	var BZ = new bezierJs.bezier_lib;
	
	
	this.get1stBezierTangent = function( previewBeziers )
	{
		var curve = new BZ.Bezier( 	previewBeziers.idx(0).p0().x, previewBeziers.idx(0).p0().y,
									previewBeziers.idx(0).p2().x, previewBeziers.idx(0).p2().y,
									previewBeziers.idx(0).p3().x, previewBeziers.idx(0).p3().y,
									previewBeziers.idx(0).p1().x, previewBeziers.idx(0).p1().y						
		);
		var tan = curve.derivative( 0 );
		return Point3d( tan.x, tan.y, 0 );
	};
	

	this.translateValuesForCurve = function( previewBeziers, deformersData, fr, info )
	{
		// This function translates injected beziers' position values to values to be set
		// on each curve deformers' attributes. All positions will be translated from
		// world coordinate OGL units to local coordinate field units before offset transformation is applied
	
		// create parent matrix
		// each deformer's parameter values will be calcurated by projecting the corresponding bezier onto this
		var preDeformer_world_matrix = deformersData.parentMatrix();
		var parentMatrix_world = preDeformer_world_matrix.multiply( Matrix4x4() );
		var preDeformer_world_matrix_inv = MT.inverseCopiedMatrix( preDeformer_world_matrix );
		
		var parentOrient = deformersData.offsetOrient();
		if( !info.keepOffsetRotation )
		{
			var bezTangent_world = this.get1stBezierTangent( previewBeziers );		
			var bezOrient_world = MT.inclinationOf( MT.origin, bezTangent_world );			
			var preDeformer_world_rotate = preDeformer_world_matrix.extractRotation();
			var parentOrient_adjust = bezOrient_world -preDeformer_world_rotate.z;			
			var OG1stP2Orient = node.getAttr( deformersData.idx(1).node(), fr, "orientation0" ).doubleValue();	
			parentOrient_adjust -= OG1stP2Orient;	
			parentOrient += parentOrient_adjust -parentOrient;	
		}
		
		var offsetTangent = MT.newPointOf( 1, parentOrient );
		var offsetPos_world = Point3d( previewBeziers.idx(0).p0().x, previewBeziers.idx(0).p0().y, 0 );
		var parentPos = preDeformer_world_matrix_inv.multiply( offsetPos_world );
		parentMatrix_world.translate( parentPos.x, parentPos.y, parentPos.z );
		parentMatrix_world.rotateDegrees( parentOrient, new Vector3d( 0, 0, 1 ) );

		// create offset's local matrix then inverse preDeformer_world_matrix from it
		var offsetMatrix = preDeformer_world_matrix_inv;
		offsetMatrix.translate( offsetPos_world.x, offsetPos_world.y, offsetPos_world.z );
		var offsetOrient = MT.inclinationOf( MT.origin, offsetTangent )
		offsetMatrix.rotateDegrees( offsetOrient, new Vector3d( 0, 0, 1 ) );		
		
		
		var valuesToSet = [];		
		for( var df = 0; df < deformersData.nodeCount(); df++ )
		{
			/* p0 == curve's start point
			 * p2 == curve's handle0
			 * p3 == curve's handle1
			 * p1 == curve's end point
			 */ 	
			 valuesForDeformer = {};	
			 
			// compute deformation param values for Offset node			
			if( df == 0 )
			{
				var p1_field = scene.fromOGL( offsetMatrix.extractPosition() );	
				valuesForDeformer.orient = ( info.keepOffsetRotation ) ?
					MT.toFieldAngle( parentOrient ):
					MT.toFieldAngle( parentOrient_adjust );
			}
			// compute deformation param values for Curve nodes	
			else
			{
				// access current bezier's end point
				var p1_world = Point3d( previewBeziers.idx(df).p0().x, previewBeziers.idx(df).p0().y, 0 );
	
				// since new P1 need to be calcurated based on its parent Matrix, subtract the parent from new P1 position
				var p1 = MT.multiplyP3dWithInverseOfMatrix( p1_world, parentMatrix_world );
				
				// convert the position to square AR, as its required by deformer with "Apply Parent Transformation" option
				var p1_field = MT.toSquare( scene.fromOGL( p1 ) );

				// handle length
				var p2_world = Point3d( previewBeziers.idx(df-1).p2().x, previewBeziers.idx(df-1).p2().y, 0 );
				var p2 = MT.multiplyP3dWithInverseOfMatrix( p2_world, parentMatrix_world );	
				var p2Length = MT.distanceOf( MT.origin, p2 ) *9;
				
				var p3_world = Point3d( previewBeziers.idx(df-1).p3().x, previewBeziers.idx(df-1).p3().y, 0 );
				var p3 = MT.multiplyP3dWithInverseOfMatrix( p3_world, parentMatrix_world );		
				var p3Length = MT.distanceOf( p1, p3 ) *9;
				
				// Original handles might have been turned more than 360. In that case, the new orientation value might be
				// in a different period of rotation from the original. Shift new orientation's period closest to the OG.
				var curNode = ( df < deformersData.nodeCount() -1 ) ? deformersData.idx(df).node() : deformersData.endNode();
				var p2Orient = MT.inclinationOf( MT.origin, p2 );
				var OGP2Orient = node.getAttr( curNode, fr, "orientation0" ).doubleValue();
				p2Orient = this.pickClosestPeriodToOG( OGP2Orient, p2Orient );							
	
				var p3Orient = MT.inclinationOf( p1, p3 );	
				var OGP3Orient = node.getAttr( curNode, fr, "orientation1" ).doubleValue();
				p3Orient += ( Math.abs( p3Orient -180 -OGP3Orient ) < Math.abs( p3Orient +180 -OGP3Orient ) ) ? -180: 180;
				p3Orient = this.pickClosestPeriodToOG( OGP3Orient, p3Orient );	
							
				valuesForDeformer.length0 = p2Length;
				valuesForDeformer.orient0 = p2Orient;
				valuesForDeformer.length1 = p3Length;
				valuesForDeformer.orient1 = p3Orient;


				// update the parentMatrix		
				parentMatrix_world.translate( p1.x, p1.y, p1.z );
				parentMatrix_world.rotateDegrees( p3Orient, new Vector3d( 0, 0, 1 ) );
			}

			valuesForDeformer.posX = p1_field.x;
			valuesForDeformer.posY = p1_field.y;
			valuesToSet.push( valuesForDeformer );
		}	
		return valuesToSet;
	};
	
	
	this.translateValuesForEnvelope = function( previewBeziers, deformersData, fr, info )
	{
		// This function translates injected beziers' position values to values to be set on each envelope deformers' attributes.
		// All positions will be translated from world coordinate OGL units to local coordinate field units
		var preDeformer_world_matrix_inv = deformersData.parentMatrix();
		preDeformer_world_matrix_inv.inverse();

		var valuesToSet = [];		
		for( var df = 0; df < deformersData.nodeCount(); df++ )
		{
			/* p0 == curve's start point / previous curve's end point
			 * p2 == curve's handle0
			 * p3 == curve's handle1
			 * p1 == curve's end point
			 */ 	
			valuesForDeformer = {};

			// positon x and y for Offset and Curve			
			var p1_world = Point3d( previewBeziers.idx(df).p0().x, previewBeziers.idx(df).p0().y, 0 );
				
			var p1_field = scene.fromOGL( preDeformer_world_matrix_inv.multiply( p1_world ) );		
			valuesForDeformer.posX = p1_field.x;
			valuesForDeformer.posY = p1_field.y;

			// compute deformation param values for Curve handles
			if( df > 0 )
			{
				// handle length
				var p0_field = Point3d( valuesToSet[df-1].posX, valuesToSet[df-1].posY, 0 );
				var p2_world = Point3d( previewBeziers.idx(df-1).p2().x, previewBeziers.idx(df-1).p2().y, 0 );
				var p2_field = scene.fromOGL( preDeformer_world_matrix_inv.multiply( p2_world ) );
				var p2_minusParent_field = p2_field.minus( p0_field );
				var p2Length = MT.distanceOf( MT.origin, p2_minusParent_field );
				
				var p3_world = Point3d( previewBeziers.idx(df-1).p3().x, previewBeziers.idx(df-1).p3().y, 0 );
				var p3_field = scene.fromOGL( preDeformer_world_matrix_inv.multiply( p3_world ) );
				var p3_minusParent_field = p3_field.minus( p1_field );
				var p3Length = MT.distanceOf( MT.origin, p3_minusParent_field );
				
				// Original handles might have been turned more than 360. In that case, the new orientation value might be
				// in a different period of rotation from the original. Shift new orientation's period closest to the OG.
				var curNode = ( df < deformersData.nodeCount() -1 ) ? deformersData.idx(df).node() : deformersData.endNode();
				var p2Orient = MT.inclinationOf( MT.origin, p2_minusParent_field );
				var OGP2Orient = node.getAttr( curNode, fr, "orientation0" ).doubleValue();
				p2Orient = this.pickClosestPeriodToOG( OGP2Orient, p2Orient );
				
				var p3Orient = MT.inclinationOf( MT.origin, p3_minusParent_field );
				var OGP3Orient = node.getAttr( curNode, fr, "orientation1" ).doubleValue();
				p3Orient += ( Math.abs( p3Orient -180 -OGP3Orient ) < Math.abs( p3Orient +180 -OGP3Orient ) ) ? -180: 180;
				p3Orient = this.pickClosestPeriodToOG( OGP3Orient, p3Orient );				

				valuesForDeformer.length0 = p2Length;
				valuesForDeformer.orient0 = p2Orient;
				valuesForDeformer.length1 = p3Length;
				valuesForDeformer.orient1 = p3Orient;
			}		
			valuesToSet.push( valuesForDeformer );
		}
		return valuesToSet;
	};
	
	
	this.pickClosestPeriodToOG = function( OGOrient, orient )
	{
		var diff = orient -OGOrient;
		var periodShift = Math.round( diff/360 ) *-360;

		return ( Math.abs( orient +periodShift -OGOrient ) < Math.abs( orient -OGOrient ) )?
			orient + periodShift : orient;
	};
	
	
	this.setOffsetAndCurve = function( deformersData, fr, valuesToSet, info )
	{
		for( var df = 0; df < deformersData.nodeCount(); df++ )
		{
			var curNode = ( df < deformersData.nodeCount() -1 ) ? deformersData.idx(df).node() : deformersData.endNode();
	
			node.setTextAttr( curNode, "offset.x", fr, valuesToSet[df].posX );
			node.setTextAttr( curNode, "offset.y", fr, valuesToSet[df].posY );
			
			if( node.type( curNode ) == "OffsetModule" && info.isCurve )
				node.setTextAttr( curNode, "orientation", fr, valuesToSet[df].orient );
			
			else if( node.type( curNode ) == "CurveModule" )
			{	
				node.setTextAttr( curNode, "orientation0", fr, valuesToSet[df].orient0 );
				node.setTextAttr( curNode, "length0", fr, valuesToSet[df].length0 );
				node.setTextAttr( curNode, "orientation1", fr, valuesToSet[df].orient1 );			
				node.setTextAttr( curNode, "length1", fr, valuesToSet[df].length1 );		
			}
		}
	};
	
	
	this.boolPointIsInPoly = function( point, poly )
	{
		// this function is written based on the following resource:
		// https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon
			var isInside = false;					
			var i = 0;
			var j = poly.length -1;
			for( i, j; i < poly.length; j = i, i ++ )
			{
				var conditionA = (poly[i].y > point.y) != (poly[j].y > point.y);
				var conditionB = point.x < (poly[j].x -poly[i].x) *(point.y - poly[i].y) /(poly[j].y - poly[i].y) +poly[i].x;				
				if( conditionA && conditionB )
					isInside = !isInside;
			}
			return isInside;
	};
	
	
	this.applyRestingValues = function( argNode, f )
	{
		var nodeType = node.type( argNode )
		var restAttrs = [], attrs = [];
		switch ( nodeType )
		{
			case "BendyBoneModule": restAttrs = [ "restoffset.x", "restoffset.y", "restradius",
												  "restorientation", "restbias", "restlength" ];
										attrs = [ "offset.x", "offset.y", "radius",
												  "orientation", "bias", "length" ]; break;
			case "OffsetModule": 	restAttrs = [ "restingoffset.x", "restingoffset.y", "restingorientation" ];
			
										attrs = [ "offset.x", "offset.y", "orientation" ]; break;	
										
			case "CurveModule": 	restAttrs = [ "restingoffset.x", "restingoffset.y", "restingorientation0",
												  "restlength0", "restingorientation1", "restlength1" ];
										attrs = [ "offset.x", "offset.y", "orientation0",
												  "length0", "orientation1", "length1" ]; break;
		}	
		for( var at = 0; at < restAttrs.length; at++ )
		{			
			var value = node.getAttr( argNode, 1, restAttrs[at] ).doubleValue();		
			node.setTextAttr( argNode, attrs[at], f, value );
		}
	};
}


exports.deformationSetter = deformationSetter;