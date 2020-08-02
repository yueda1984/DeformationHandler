function math()
{
	this.origin = Point3d();
	
	this.distanceOf = function( point1, point2 ) 
	{
		var distance = Math.sqrt( (point2.x - point1.x) * (point2.x - point1.x)
								+ (point2.y - point1.y) * (point2.y - point1.y) );
		return parseFloat( distance.toFixed(20) );
	}
		
	this.inclinationOf = function( point1, point2 )
	{
		var inclination = Math.atan2( point2.y - point1.y, point2.x - point1.x ) *( 180 / Math.PI );
		return parseFloat( inclination.toFixed(20) );
	}
	
	this.newPointOf = function( distance, inclination )
	{		
		var x = distance *Math.cos( inclination *( Math.PI/180 ) );
		var y = distance *Math.sin( inclination *( Math.PI/180 ) );		
		return Point3d( parseFloat( x.toFixed(20) ), parseFloat( y.toFixed(20) ), 0 );		
	}	
		
	this.rotatedPointOf = function( pivot, pointToRotate, rotateAmount )
	{
		var inclination = this.inclinationOf( pivot, pointToRotate ) + rotateAmount;
		var distance = this.distanceOf( pivot, pointToRotate );			
		var x = distance *Math.cos( inclination *( Math.PI/180 ) ) + pivot.x;
		var y = distance *Math.sin( inclination *( Math.PI/180 ) ) + pivot.y;
		
		if( "z" in pivot && "z" in pointToRotate )
			return Point3d( parseFloat( x.toFixed(20) ), parseFloat( y.toFixed(20) ), 0 );
		else
			return Point2d( parseFloat( x.toFixed(20) ), parseFloat( y.toFixed(20) ) );			
	}
	
	this.midPointAt = function( p1, p2, t )
	{
		var x = ( p1.x *(1 -t) + p2.x *t );
		var y = ( p1.y *(1 -t) + p2.y *t );
		
		if( "z" in p1 && "z" in p2 )
		{
			var z = ( p1.z *t + p2.z *(1 -t) );
			return Point3d( parseFloat( x.toFixed(20) ), parseFloat( y.toFixed(20) ), parseFloat( z.toFixed(20) ) );
		}
		else
			return Point3d( parseFloat( x.toFixed(20) ), parseFloat( y.toFixed(20) ), 0 );
	}
	
	this.sumOf = function( p3d_A, p3d_B )
	{
		if( "z" in p3d_A && "z" in p3d_B )
			return Point3d( p3d_A.x + p3d_B.x, p3d_A.y + p3d_B.y, p3d_A.z + p3d_B.z );
		else
			return Point2d( p3d_A.x + p3d_B.x, p3d_A.y + p3d_B.y );			
	}
	
	this.productOf = function( p3d_A, p3d_B )
	{
		if( "z" in p3d_A && "z" in p3d_B )
			return Point3d( p3d_A.x * p3d_B.x, p3d_A.y * p3d_B.y, p3d_A.z * p3d_B.z );
		else
			return Point2d( p3d_A.x * p3d_B.x, p3d_A.y * p3d_B.y );				
	}
	
	this.subtractBFromA = function( p3d_A, p3d_B )
	{
		if( "z" in p3d_A && "z" in p3d_B )
			return Point3d( p3d_A.x - p3d_B.x, p3d_A.y - p3d_B.y, p3d_A.z - p3d_B.z );
		else
			return Point2d( p3d_A.x - p3d_B.x, p3d_A.y - p3d_B.y );			
	}
	
	this.divideAByB = function( p3d_A, p3d_B )
	{
		if( "z" in p3d_A && "z" in p3d_B )
			return Point3d( p3d_A.x / p3d_B.x, p3d_A.y / p3d_B.y, p3d_A.z / p3d_B.z );
		else
			return Point2d( p3d_A.x / p3d_B.x, p3d_A.y / p3d_B.y );		
	}
	
	// use these functions to prevent the original matrix from getting inversed
	this.multiplyP3dWithInverseOfMatrix = function( p3d, matrix )
	{
		var newMatrix = matrix.multiply( Matrix4x4() );		
		newMatrix.inverse();
		return newMatrix.multiply( p3d );
	}
	this.inverseCopiedMatrix = function( matrix )
	{
		var newMatrix = matrix.multiply( Matrix4x4() );		
		newMatrix.inverse();
		return newMatrix;
	}


/* Units in Harnmony
 *
 * Harmony interface uses Field unit, which follows the scene aspect ratio. Default is x-4 by y-3.
 * We can use scene.toOGL() to convert Field to OGL unit.
 *
 * Only "Apply Parent Transformation" mode Curve module uses square AR Field unit (fieldSq). This module uses a square AR unit
 * because the module's attributes should not be affected by scene aspect ratio when its parent module is rotated.
 * 1 OGL == 12 *( scene.unitsAspectRatioY() / scene.unitsAspectRatioX() ) fieldSq.
 *
 * Under the hood, Harmony uses OpenGL unit (OGL), including Matrix and Point3D.
 * This unit uses square AR. We can use scene.fromOGL() to convert to field unit.
 * 1 OGL_x == 12 *( scene.unitsAspectRatioY() / scene.unitsAspectRatioX() ) Field_x.
 * 1 OGL_y == 12 Field_y.
 *
 * Drawing Tools internally uses own square AR unit. Let's call it "Tool" unit for convenience. 1 OGL == 1875 Tool.
 */


	this.toSquare = function( p3d_field )
	{
		var fieldSqY = p3d_field.y *( scene.unitsAspectRatioY() / scene.unitsAspectRatioX() );
		return Point3d( p3d_field.x, fieldSqY, p3d_field.z );		
	}
	
	this.fieldSqToOGL = function( p3d_fieldSq )
	{
		var cameraWidth_OGL = 12*( scene.unitsAspectRatioY() / scene.unitsAspectRatioX() )
		return Point3d( p3d_fieldSq.x /cameraWidth_OGL, p3d_fieldSq.y /cameraWidth_OGL, p3d_fieldSq.z /cameraWidth_OGL );
	}
		
	this.martrixToField = function( matrix )
	{
		var p3d = matrix.multiply( Point3d() );
		return scene.fromOGL( p3d );		
	}
	
	this.toSquareAngle = function( orient )
	{
		return this.angleConverter( orient, "toSquare" );
	}
	
	this.toFieldAngle = function( orient )
	{
		return this.angleConverter( orient, "toField" );
	}	
	
	this.angleConverter = function( orient, mode )
	{
		if ( mode == "toSquare" )
			var aspect = { x: 1, y: scene.unitsAspectRatioY() /scene.unitsAspectRatioX() };
		else // mode == "toField"
			var aspect = { x: 1, y: scene.unitsAspectRatioX() /scene.unitsAspectRatioY() };			
	
		var opposite = aspect.x *Math.tan( orient%180 *( Math.PI/180 ));
		var orient_prime = Math.atan2( opposite *aspect.y, aspect.x ) *(180/Math.PI);
		
		if      ( orient%360 > 90 && orient%360 < 270 )
			orient_prime += 180;
		else if ( orient%360 < -90 && orient%360 > -270 )
			orient_prime -= 180;
		
		// check each rotation period of orient and orient_prime.
		// shift orient_prime's period based on the difference		
		function checkRotationPeriod( rotate )
		{
			if( rotate > 180 )
				return Math.floor( ( rotate +179.9999999999 )/360 );
			else if( rotate <= -180 )
				return Math.floor( ( rotate -180 )*-1 /360 )*-1;
			else
				return 0;
		}
		var period = checkRotationPeriod( orient );
		var period_prime = checkRotationPeriod( orient_prime );
		var periodShiftVal = ( period -period_prime ) *360;

		return orient_prime + periodShiftVal;
	}
	
	this.logPoint = function( point )
	{
		MessageLog.trace( "Point.x: " +  point.x );
		MessageLog.trace( "Point.y: " +  point.y );	
		if( "z" in point )
			MessageLog.trace( "Point.z: " +  point.z );
	}
	
	this.logPointInField = function( point )
	{
		MessageLog.trace( "Point.x: " +  scene.fromOGLX( point.x ) );
		MessageLog.trace( "Point.y: " +  scene.fromOGLY( point.y ) );
		if( "z" in point )
			MessageLog.trace( "Point.z: " +  scene.fromOGLZ( point.z ) );
	}	

	this.logMatrix = function( matrix )
	{
		var keywords = [ 	[ "m00", "m01", "m02", "m03" ],
							[ "m10", "m11", "m12", "m13" ],
							[ "m20", "m21", "m22", "m23" ],
							[ "m30", "m31", "m32", "m33" ]
						];						
							
		for( var row = 0; row < keywords.length; row++ )
		{
			MessageLog.trace( keywords[row][0] + ": " + matrix[ keywords[row][0] ].toFixed(3) );			
			MessageLog.trace( keywords[row][1] + ": " +  matrix[ keywords[row][1] ].toFixed(3) );			
			MessageLog.trace( keywords[row][2] + ": " +  matrix[ keywords[row][2] ].toFixed(3) );

			switch( row )
			{
				case 0 : var t_val = scene.fromOGLX( matrix[ keywords[row][3] ] ); break;
				case 1 : var t_val = scene.fromOGLY( matrix[ keywords[row][3] ] ); break;
				case 2 : var t_val = scene.fromOGLZ( matrix[ keywords[row][3] ] ); break;
				case 3 : var t_val = matrix[ keywords[row][3] ];			
			}
			MessageLog.trace( keywords[row][3] + ": " +  t_val + "\n" );
		}
	}	
}

exports.math = math;
