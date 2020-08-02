var mathLibrary = require( "../MathUtility.js" );
var deformerClass = require( "./DeformersDataClassDefinition.js" );

// This script uses some functions on MIT licensed library "bezier.js" by Pomax (https://pomax.github.io/bezierjs/).
var bezierJs = require( "../bezierjs/bezier.js" );

function deformationPickup()
{
	var PF = new private_functions;
	var BZ = new bezierJs.bezier_lib;
	var MT = new mathLibrary.math;		


	this.pickDeformersOfSelectedDrawing = function( sNode, fr )
	{
		var useTiming = node.getAttr( sNode, 1, "drawing.elementMode" ).boolValue();
		var col = node.linkedColumn( sNode, useTiming ? "drawing.element" : "drawing.customName.timing" );
		var celName = column.getEntry( col, 1, fr );
		if( celName == "" )
			return null;

		var parGroup = node.parentNode( sNode );
		var activeChain = PF.trackUpToFindDeformers( sNode, parGroup, 0, celName, "noSwitch" );				
		if( activeChain == null )
			return null;

		var deformersData = this.getDeformersData( activeChain.nodes[0], activeChain.switches[0], fr );
		PF.showDeformation( deformersData.idx(0).node() );		
		return deformersData;
	};
	
	
	this.getDeformersData = function( deformerChain, switchNode, fr )
	{
		/* This function retirieves positions and other geomatric data in world coordinate.
		 * All data are also converted from field to OpenGL unit.
		 * Turn collected data into a DeformersData class object at the end.

		 * p0 == curve's start point / previous curve's end point
		 * p2 == curve's handle0
		 * p3 == curve's handle1
		 * p1 == curve's end point
		 */	
		var data = [];

		// check if deformer is in curve, closed envelope, or open envelope mode
		var isCurve = ( node.getTextAttr( deformerChain[deformerChain.length -1], fr, "localReferential" ) == "Y" ); 
		var isClosed = ( !isCurve && ( node.getTextAttr( deformerChain[deformerChain.length -1], fr, "closepath" ) == "Y" ) ); 

		// get the accumulated transformation matrix before entering the current deformation chain
		var offsetMatrix = deformation.nextDeformMatrix( deformerChain[0], fr );
		var preDeformer_world_matrix = PF.getPreDeformerMatrixInWorld( offsetMatrix, deformerChain[0], fr );			
		var offset_world_matrix = preDeformer_world_matrix.multiply( offsetMatrix );
		var offsetPos_world = offset_world_matrix.multiply( Point3d() );
		var offsetOrient = MT.toSquareAngle( node.getAttr( deformerChain[0], fr, "orientation" ).doubleValue() );
		data.push([{	x: offsetPos_world.x,
						y: offsetPos_world.y,
						orient: offsetOrient,
						node: deformerChain[0],
						switchNode: switchNode,
						parentMatrix: preDeformer_world_matrix
					}]);
					
		var p0_matrix = deformation.nextDeformMatrix( deformerChain[0], fr );

		for( var df = 1; df < deformerChain.length; df++ )
		{	
			// when parsing the end curve node on closed envelope, position is same as offset
			if( df == deformerChain.length -1 && !isCurve && isClosed )	
				var p1_matrix = deformation.nextDeformMatrix( deformerChain[0], fr );
			else
				var p1_matrix = deformation.nextDeformMatrix( deformerChain[df], fr );				
		
			var p1 = p1_matrix.multiply( Point3d() );
			var p1_world = ( df == deformerChain.length -1 && !isCurve && isClosed ) ?
				offsetPos_world :
				preDeformer_world_matrix.multiply( p1 );
			
			var p2Orient = node.getAttr( deformerChain[df], fr, "orientation0" ).doubleValue();
			var p2Length = node.getAttr( deformerChain[df], fr, "length0" ).doubleValue();			
			var p3Orient = node.getAttr( deformerChain[df], fr, "orientation1" ).doubleValue();
			var p3Length = node.getAttr( deformerChain[df], fr, "length1" ).doubleValue();			
	
			if( isCurve )
			{
				var p2_fieldSq = MT.rotatedPointOf( MT.origin, Point3d( p2Length, 0, 0 ), p2Orient );
				var p2 = MT.fieldSqToOGL( p2_fieldSq );
				p2 = p0_matrix.multiply( p2 );						

				var prevP1Orient = p0_matrix.extractRotation();
				p3Orient += prevP1Orient.z;						
				var p3_fieldSq = MT.rotatedPointOf( MT.origin, Point3d( p3Length, 0, 0 ), p3Orient +180 );
				var p3 = MT.fieldSqToOGL( p3_fieldSq );				
				p3 = MT.sumOf( p1, p3 );									
			}
			else // envelope deformer
			{
				var p2_field = MT.rotatedPointOf( MT.origin, Point3d( p2Length, 0, 0 ), p2Orient );
				var p2 = scene.toOGL( p2_field );
				var p0 = p0_matrix.extractPosition();
				p2 = MT.sumOf( p0, p2 );
		
				var p3_field = MT.rotatedPointOf( MT.origin, Point3d( p3Length, 0, 0 ), p3Orient +180 );
				var p3 = scene.toOGL( p3_field );
				p3 = MT.sumOf( p1, p3 );							
			}
			
			var p2_world = preDeformer_world_matrix.multiply( p2 );
			var prevP1_world = Point2d( data[ data.length -1 ][0].x, data[ data.length -1 ][0].y );
			var p2Length_world = MT.distanceOf( p2_world, prevP1_world );
					
			var p3_world = preDeformer_world_matrix.multiply( p3 );
			var p3Length_world = MT.distanceOf( p3_world, p1_world );		
			
			var points = [];
			points.push( { x: p2_world.x, y: p2_world.y, length: p2Length_world } );					
			points.push( { x: p3_world.x, y: p3_world.y, length: p3Length_world } );
			data[df-1].push.apply( data[df-1], points );
			
			data.push( [{ x: p1_world.x, y: p1_world.y, node: deformerChain[df] }] );
			
			p0_matrix = p1_matrix;
		}

		// calcurate the length and point data at ( t = 0.5 ) for each deformer curves
		for( var df = 0; df < data.length-1; df++ )
		{
			// If p0 == p2 && p1 == nextP0, its a straight (degenerate) bezier.
			if( data[df][0].x == data[df][1].x &&
				data[df][0].y == data[df][1].y &&
				data[df][2].x == data[df+1][0].x &&
				data[df][2].y == data[df+1][0].y
			)
			{
				data[df][0].length = MT.distanceOf( data[df][0], data[df+1][0] );
				data[df][0].halfPoint = MT.midPointAt( data[df][0], data[df+1][0], 0.5 );
				data[df][0].normalAngle = MT.inclinationOf( data[df][0], data[df+1][0] ) +90;
			}
			else
			{
				var BZ = new bezierJs.bezier_lib;
				var curve = new BZ.Bezier(	data[df][0].x, data[df][0].y,
											data[df][1].x, data[df][1].y,
											data[df][2].x, data[df][2].y,
											data[df+1][0].x, data[df+1][0].y
				);
				data[df][0].length = curve.length();
				data[df][0].halfPoint = curve.get(0.5);
				data[df][0].normalAngle = MT.inclinationOf( MT.origin, curve.normal(0.5) );
			}
		}
		return new deformerClass.DeformersData( data, isClosed );
	};
}



function private_functions()
{
	this.getDeformationChainInOrder = function( lastNode, parGroup )
	{
		var chain = [ lastNode ];
		
		var numSubNodes = node.numberOfSubNodes( parGroup );	
		var src = node.srcNode( lastNode, 0 );		
		for ( var nd = 0; nd < numSubNodes; nd++ )
		{
			if( node.type( src ) == "OffsetModule" || node.type( src ) == "CurveModule" )
				chain.unshift( src );
			else
				break;

			src = node.srcNode( src, 0 );
			}
		return chain;
	};	


	this.trackUpToFindDeformers = function( lastNode, parGroup, startPort, celName, switchNode )
	{
		var numSubNodes = node.numberOfSubNodes( parGroup );
		var src = node.srcNode( lastNode, startPort );		
		for ( var nd = 0; nd < numSubNodes; nd++ )
		{
			if( node.type( src ) == "DeformationCompositeModule" &&
				node.getTextAttr ( src, 1, "outputkinematicchainselector" ) == "Use First Connected Element's Exposure as Key"
			)
			{
				var celNameSplit = celName.split( "+" );
				for( var ip = 0; ip < node.numberOfInputPorts( src ); ip++ )
				{
					var curSrc = node.srcNode( src, ip );
					if( node.getName( curSrc ) == celNameSplit[0] && node.type( curSrc ) == "GROUP" )
					{
						switchNode = src;
						lastNode = src;
						src = curSrc;
						break;
					}
				}
			}
			else if( node.type( src ) == "TransformationSwitch" )
			{
				// create the list of entries on Transformation Names attribute:	
				var celList = [], celIdx = [];
				for( var pt = 1; pt < node.numberOfInputPorts( src ); pt++ )
				{
					var str = node.getTextAttr( src, 1, "transformationnames.transformation" + [pt] );	
					var foundNames = str.split ( ";" );
					if( foundNames.indexOf( celName ) !== -1 )
					{
						switchNode = src;
						lastNode = src;
						src = node.srcNode( src, pt );
						break;
					}
				}			
			}
			
			if( node.type( src ) == "CurveModule" )
			{
				var chain = this.getDeformationChainInOrder( src, parGroup );
				return { nodes: [ chain ], switches: [ switchNode ] };
			}
			
			else if( node.type( src ) == "GROUP" )
			{
				var srcInfo = node.srcNodeInfo( lastNode, 0 );
				var portOutNode = node.getGroupOutputModule( src, "", 0,0,0 );
				return this.trackUpToFindDeformers( portOutNode, src, srcInfo.port, celName, switchNode );
			}
			
			lastNode = src;
			src = node.srcNode( src, 0 );
		}
		return null;
	};
	
	
	this.showDeformation = function( deformer )
	{	
		selection.clearSelection();
		selection.addNodeToSelection( deformer );
		Action.perform( "onActionShowSelectedDeformers()", "miniPegModuleResponder" );
		selection.clearSelection();		
	};
	
	
	this.getPreDeformerMatrixInWorld = function( offsetMatrix, offset, fr )
	{
		var offsetRestMatrix = deformation.nextRestMatrix( offset );

		offsetRestMatrix.inverse();
		offsetMatrix = offsetMatrix.multiply( offsetRestMatrix );
		offsetMatrix.inverse();
		
		var preDeformer_world_matrix = node.getMatrix( offset, fr );	
		return preDeformer_world_matrix.multiply( offsetMatrix );
	};
}	


exports.deformationPickup = deformationPickup;