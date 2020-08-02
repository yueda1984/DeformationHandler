var mathLibrary = require( "../MathUtility.js" );

// This script uses some functions on MIT licensed library "bezier.js" by Pomax (https://pomax.github.io/bezierjs/).
var bezierJs = require( "../bezierjs/bezier.js" );


function DeformersData( source, isClosed )
{
	var PF = new private_functions;
	
	
	//------------------------------------ constructor ------------------------------------>
	
	this._objectName = "DeformersData";
	this._isClosed = isClosed;
	this._idx = 0;


	// Construct from passed object made through deformationPickup.getDeformersData(),
	// or array of paths made by Drawing.geometry.fit()
	if( source._objectName !== "DeformersData" )
	{
		this._nodeCount = source.length;
		this._pathCount = source.length -1;
		
		// offset info
		if( "orient" in source[0][0] )
			this._offsetOrient = source[0][0].orient;	
		if( "switchNode" in source[0][0] )
			this._switchNode = source[0][0].switchNode;
		if( "parentMatrix" in source[0][0] )
			this._parentMatrix = source[0][0].parentMatrix.multiply( Matrix4x4() );
			

		for( var bz = 0; bz < this._pathCount; bz++ )
		{
			this[bz] = {};
			
			// curve info
			if( "node" in source[bz][0] )
				this[bz]._node = source[bz][0].node;
			if( "length" in source[bz][0] )
				this[bz]._cachedLength = source[bz][0].length;
			if( "halfPoint" in source[bz][0] )
				this[bz]._halfPoint = { x: source[bz][0].halfPoint.x, y: source[bz][0].halfPoint.y };
			if( "normalAngle" in source[bz][0] )
				this[bz]._normalAngle = source[bz][0].normalAngle;	
			
			// p0
			this[bz]._p0 = { x: source[bz][0].x, y: source[bz][0].y };				
			
			// p2
			this[bz]._p2 = { x: source[bz][1].x, y: source[bz][1].y };
			if( "length" in source[bz][1] )
				this[bz]._p2Length = source[bz][1].length;
			
			// p3		
			this[bz]._p3 = { x: source[bz][2].x, y: source[bz][2].y };
			if( "length" in source[bz][2] )
				this[bz]._p3Length = source[bz][2].length;	
		}
		this[this._pathCount] = {};
		// info of last p0 in the chain. for open curve, store the last node position
		if( !this._isClosed )
			this[this._pathCount]._p0 = { x: source[this._pathCount][0].x, y: source[this._pathCount][0].y };
		if( "node" in source[this._pathCount][0] )
			this[this._pathCount]._node = source[this._pathCount][0].node;
	}
	
	// Construct the deep copy of passed DeformersData object
	else //source._objectName == "DeformersData"
	{
		this._nodeCount = source._nodeCount;
		this._pathCount = source._pathCount;
		
		
		// offset info
		if( "_offsetOrient" in source )
			this._offsetOrient = source._offsetOrient;	
		if( "_switchNode" in source )
			this._switchNode = source._switchNode;
		if( "_parentMatrix" in source )
			this._parentMatrix = source._parentMatrix.multiply( Matrix4x4() );


		for( var bz = 0; bz < this._pathCount; bz++ )
		{
			this[bz] = {};	
			
			// curve info
			if( "_node" in source[bz] )
				this[bz]._node = source[bz]._node;
			if( "_cachedLength" in source[bz] )
				this[bz]._cachedLength = source[bz]._cachedLength;
			if( "_halfPoint" in source[bz] )
				this[bz]._halfPoint = { x: source[bz]._halfPoint.x, y: source[bz]._halfPoint.y };
			if( "_normalAngle" in source[bz] )
				this[bz]._normalAngle = source[bz]._normalAngle;			

			// p0
			this[bz]._p0 = { x: source[bz]._p0.x, y: source[bz]._p0.y };	

			// p2
			this[bz]._p2 = { x: source[bz]._p2.x, y: source[bz]._p2.y };	
			if( "_p2Length" in source[bz] )
				this[bz]._p2Length = source[bz]._p2Length;
			
			// p3		
			this[bz]._p3 = { x: source[bz]._p3.x, y: source[bz]._p3.y };	
			if( "_p3Length" in source[bz] )
				this[bz]._p3Length = source[bz]._p3Length;			
		}
		// info of last p0 in the chain
		this[this._pathCount] = {};
		if( "_p0" in source[this._pathCount] )
			this[this._pathCount]._p0 = { x: source[this._pathCount]._p0.x, y: source[this._pathCount]._p0.y };	
		if( "_node" in source[this._pathCount] )
			this[this._pathCount]._node = source[this._pathCount]._node;
	}
	


	//------------------------------------ setters ------------------------------------>
	// index selector
	this.idx = function( argInt ){
		this._idx = ( this._isClosed ) ? PF.getValidIdx( argInt, this._pathCount ) : argInt;
		return this;
	};
	this.index = this.idx; // alias
	
	// position setters, should be chained after setting target index using index selector
	this.setP0 = function( val1, val2 ){
		this[this._idx]._p0 = { x: val1, y: val2 };
	};		
	this.setP2 = function( val1, val2 ){
		this[this._idx]._p2 = { x: val1, y: val2 };	
	};
	this.setP3 = function( val1, val2 ){
		this[this._idx]._p3 = { x: val1, y: val2 };
	};
	this.setP1 = function( val1, val2 ){
		if( this._isClosed )
		{
			var nextP0Idx = PF.getValidIdx( this._idx +1, this._pathCount );
			this[nextP0Idx]._p0 = { x: val1, y: val2 };
		}
		else
			this[this._idx +1]._p0 = { x: val1, y: val2 };
	};



	//------------------------------------ getters ------------------------------------>
	// following getters should be chained after setting target index using index selector
	this.p0 = function(){
		return this[this._idx]._p0;
	};
	this.p2 = function(){
		return this[this._idx]._p2;
	};
	this.p3 = function(){
		return this[this._idx]._p3;
	};
	this.p1 = function()
	{
		if( this._isClosed )
		{
			var nextP0Idx = PF.getValidIdx( this._idx +1, this._pathCount );
			return this[nextP0Idx]._p0;
		}else
			return this[this._idx +1]._p0;			
	};
	
	this.p2Length = function(){
		return this[this._idx]._p2Length;
	};	
	this.p3Length = function(){
		return this[this._idx]._p3Length;
	};
	
	this.node = function(){
		return this[this._idx]._node;
	};	
	this.curveLength = function(){
		var path = [ this[this._idx]._p0, this[this._idx]._p2, this[this._idx]._p3, this.p1() ];
		return PF.getBezierLength( path );	
	};
	this.cachedLength = function(){
		return this[this._idx]._cachedLength;		
	};
	this.halfPoint = function(){
		return this[this._idx]._halfPoint;
	};	
	this.normalAngle = function(){
		return this[this._idx]._normalAngle;
	};
	
	
	// following getters should be used without idx selector
	this.objectName = function(){	
		return this._objectName;
	};
	this.isClosed = function(){	
		return this._isClosed;
	};
	this.pathCount = function(){
		return this._pathCount;
	};
	this.nodeCount = function(){	
		return this._nodeCount;
	};
	this.offsetOrient = function(){
		return this._offsetOrient;	
	};
	this.switchNode = function(){
		return this._switchNode;
	};
	this.parentMatrix = function(){
		return this._parentMatrix;
	};
	this.endNode = function(){
		return this[this._pathCount]._node;
	};
	this.nodeList = function(){
		var nodeList = [];
		for( var i = 0; i < this._nodeCount; i++ )
			nodeList.push( this[i]._node );
		return nodeList;
	};
	this.totalLength = function(){
		var totalLength = 0;
		for( var i = 0; i < this._pathCount; i++ )
		{
			this._idx = i;
			var path = [ this[i]._p0, this[i]._p2, this[i]._p3, this.p1() ];
			totalLength += PF.getBezierLength( path );	
		}
		return totalLength;
	};
	this.totalCachedLength = function(){
		var totalLength = 0;
		for( var i = 0; i < this._pathCount; i++ )
		{
			if( "_cachedLength" in this[i] )
				totalLength += this[i]._cachedLength;
			else{
				this._idx = i;
				var path = [ this[i]._p0, this[i]._p2, this[i]._p3, this.p1() ];
				totalLength += PF.getBezierLength( path );
			}		
		}
		return totalLength;
	};
}


function private_functions()
{
	var MT = new mathLibrary.math;
	var BZ = new bezierJs.bezier_lib;
	
	this.getValidIdx = function( idx, pathCount )
	{
		// if passed idx is bigger than pathCount, subtract pathCount from the idx.
		if( idx >= pathCount ){
			return idx -( pathCount *parseInt( idx /pathCount) );
		}else if( idx < 0 ){
			return idx +( pathCount *Math.ceil( Math.abs( idx ) /pathCount) );
		}else
			return idx;
	};
	
	
	this.getBezierLength = function( bezier )
	{
		// degenerate bezier
		if( bezier[0].x == bezier[1].x &&
			bezier[0].y == bezier[1].y &&
			bezier[2].x == bezier[3].x &&				
			bezier[2].y == bezier[3].y
		)				
			return MT.distanceOf( bezier[0], bezier[3] );	
		else{
			var bez = new BZ.Bezier( 	bezier[0].x, bezier[0].y,
										bezier[1].x, bezier[1].y,
										bezier[2].x, bezier[2].y,
										bezier[3].x, bezier[3].y
			);
			return bez.length();				
		}
	};
}


exports.DeformersData = DeformersData;