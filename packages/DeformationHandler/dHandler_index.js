var commonLib = require( "./lib/dHandler/CommonLibrary.js" );
var deformPick = require( "./lib/dHandler/DeformationPickup.js" );
var deformSet = require( "./lib/dHandler/DeformationSetter.js" );
var snapInterpret = require( "./lib/dHandler/SnapInterpreter.js" );


function toolConfig()
{
    var toolconfig = {
						toolId : "com.yuueda.deformationHandler",		
						toolName: "Deformation Handler",
						description : "Deformation Handler",
						shortcut : true,
						toolbar: true,
						toolBarName : "YU Deformer Tools",
						icon : "DeformationHandler.png",
						uiFile : "DeformationHandler.ui",
						slug: "deformationHandler",
						toolBarId: "com.yuueda.deformerToolToolbar"
					};
					
	return toolconfig;
}


function registerTool( packageFolder )
{	
	var CL = new commonLib.commonLibrary;
	var DP = new deformPick.deformationPickup;
	var DS = new deformSet.deformationSetter;
	var SI = new snapInterpret.snapInterpreter;
	var toolConf = toolConfig();	


	System.println( "Registering"+ toolConf.toolName+" : " + __file__ );
	System.println( System.getenv( "HOME" ) );

	var toolDefinition = {		
		name: toolConf.toolId,
		displayName: toolConf.toolName,
		icon: toolConf.icon,
		toolType: "scenePlanning",
		canBeOverridenBySelectOrTransformTool: true,
		resourceFolder: "resources",

		onRegister: function()
		{
			// This is called once when registering the tool
			// Here the developer can, for example, initialize the tool options
			// from the preferences
			System.println( "Registered tool : " + this.resourceFolder );
			this.loadFromPreferences();
		},
		
		
		//------------------------------------ Tool Preference panel ------------------------------------>
		
		
		preferenceName: this.name + ".settings",
		
		options: {
							maxCornerAngle: 160,
							onCorner: false,
							avoidCorner: true,
							keepLength: true,
							keepProportion: true,
							keepRotation: false,
							keepShape: false,
							keepOffsetRotation: false,
							allowSnapStart: true,
							allowSnapEnd: true,
							roundSnappedCorner: true,
							snapDist: 25
		},
		
		defaultOptions: {
							maxCornerAngle: 160,
							onCorner: false,
							avoidCorner: true,
							keepLength: true,
							keepProportion: true,
							keepRotation: false,
							keepShape: false,
							keepOffsetRotation: false,
							allowSnapStart: true,
							allowSnapEnd: true,
							roundSnappedCorner: true,
							snapDist: 25
		},
		
		loadFromPreferences: function()
		{
			try
			{
				var v = preferences.getString( this.preferenceName, JSON.stringify( this.defaultOptions ) );
				this.options = JSON.parse( v );
			}
			catch(e)
			{
				this.options = this.defaultOptions;
			}
		},
		
		storeToPreferences: function()
		{
			preferences.setString( this.preferenceName, JSON.stringify( this.options ) );
		},

		loadPanel: function( dialog, responder )
		{
			var uiFile = this.resourceFolder + "/" +toolConf.uiFile;
			System.println( "UIfilename:" +toolConf.uiFile );
			try
			{
				var ui = UiLoader.load({
										  uiFile: uiFile,
										  parent: dialog,
										  folder: this.resourceFolder
				});
				this.ui = ui;	

				this.refreshNodeDisplay();
				
				var cornerMenu = new QMenu;	
				var onCornerIcon = new QIcon( this.resourceFolder + "/dHandler_onCorner.png" );	
				var onCornerAction = cornerMenu.addAction( onCornerIcon, "Place Joints On Corners" );		
				var avoidCornerIcon = new QIcon( this.resourceFolder + "/dHandler_avoidCorner.png" );
				var avoidCornerAction = cornerMenu.addAction( avoidCornerIcon, "Place Joints Avoiding Corners" );							
				ui.toolOpBox.cornerOpBtn.setMenu(cornerMenu);
				var defaultCornerAction = ( this.options.onCorner ) ? onCornerAction : avoidCornerAction;
				ui.toolOpBox.cornerOpBtn.setDefaultAction( defaultCornerAction );
				ui.toolOpBox.cornerOpBtn['triggered(QAction*)'].connect( this, function(v)
				{				
					ui.toolOpBox.cornerOpBtn.setDefaultAction(v);
					this.options.onCorner = ( v.text == "Place Joints On Corners" );				
					this.options.avoidCorner = ( v.text == "Place Joints Avoiding Corners" );
					this.storeToPreferences();
				});
				
				ui.toolOpBox.cornerAngleSB.setValue( this.options.maxCornerAngle );
				ui.toolOpBox.cornerAngleSB['valueChanged(int)'].connect( this, function(v)
				{
					this.options.maxCornerAngle = v;
					this.storeToPreferences();
				});
				
				ui.toolOpBox.keepLengthBtn.setChecked( this.options.keepLength );
				ui.toolOpBox.keepLengthBtn.icon = new QIcon( this.resourceFolder + "/dHandler_KeepLength.png" );
				ui.toolOpBox.keepLengthBtn['toggled(bool)'].connect( this, function(v)
				{
					this.options.keepLength = v;
					this.storeToPreferences();
				});	
				
				ui.toolOpBox.keepProportionBtn.setChecked( this.options.keepProportion );
				ui.toolOpBox.keepProportionBtn.icon = new QIcon( this.resourceFolder + "/dHandler_keepProportion.png" );
				ui.toolOpBox.keepProportionBtn['toggled(bool)'].connect( this, function(v)
				{
					this.options.keepProportion = v;
					this.storeToPreferences();
				});	
				
				ui.toolOpBox.keepRotationBtn.hide();
				/*ui.toolOpBox.keepRotationBtn.setChecked( this.options.keepRotation );
				ui.toolOpBox.keepRotationBtn.icon = new QIcon( this.resourceFolder + "/dHandler_keepRotation.png" );
				ui.toolOpBox.keepRotationBtn['toggled(bool)'].connect( this, function(v)
				{
					this.options.keepRotation = v;
					this.storeToPreferences();
				});*/
				
				ui.toolOpBox.keepShapeBtn.setChecked( this.options.keepShape );
				ui.toolOpBox.keepShapeBtn.icon = new QIcon( this.resourceFolder + "/dHandler_keepShape.png" );
				ui.toolOpBox.keepShapeBtn['toggled(bool)'].connect( this, function(v)
				{
					this.options.keepShape = v;
					this.storeToPreferences();
				});
				
				ui.toolOpBox.keepOffsetRotationBtn.setChecked( this.options.keepOffsetRotation );
				ui.toolOpBox.keepOffsetRotationBtn.icon = new QIcon( this.resourceFolder + "/dHandler_keepOffsetRotation.png" );
				ui.toolOpBox.keepOffsetRotationBtn['toggled(bool)'].connect( this, function(v)
				{
					this.options.keepOffsetRotation = v;
					this.storeToPreferences();
				});

				ui.snapOpBox.snapStartBtn.setChecked( this.options.allowSnapStart );
				ui.snapOpBox.snapStartBtn.icon = new QIcon( this.resourceFolder + "/dHandler_SnapStart.png" );
				ui.snapOpBox.snapStartBtn['toggled(bool)'].connect( this, function(v)
				{
					this.options.allowSnapStart = v;
					this.storeToPreferences();
				});
				
				ui.snapOpBox.snapEndBtn.setChecked( this.options.allowSnapEnd );
				ui.snapOpBox.snapEndBtn.icon = new QIcon( this.resourceFolder + "/dHandler_SnapEnd.png" );
				ui.snapOpBox.snapEndBtn['toggled(bool)'].connect( this, function(v)
				{
					this.options.allowSnapEnd = v;
					this.storeToPreferences();
				});
								
				ui.snapOpBox.roundSnappedBtn.setChecked( this.options.roundSnappedCorner );
				ui.snapOpBox.roundSnappedBtn.icon = new QIcon( this.resourceFolder + "/dHandler_RoundSnappedCorner" );
				ui.snapOpBox.roundSnappedBtn['toggled(bool)'].connect( this, function(v)
				{
					this.options.roundSnappedCorner = v;
					this.storeToPreferences();
				});	
				
				ui.snapOpBox.snapDistSB.setValue( this.options.snapDist );
				ui.snapOpBox.snapDistSB['valueChanged(int)'].connect( this, function(v)
				{
					this.options.snapDist = v;
					this.storeToPreferences();
				});			
			}
			catch(e)
			{
				System.println( "Exception: " + e );
			}			
			System.println( "Loaded panel" );

		},
				
		refreshNodeDisplay: function()
		{
			// update the list of nodes displayed in the tool preference panel
			if( this.deformersData !== null )
			{
				var nodeList = this.deformersData.nodeList();
				var message = nodeList[0];
				for( var df = 1; df < nodeList.length; df++ )
					message += "\n" + nodeList[df];
			}
			else
				var message = "No Deformers have been registered. \nPlease use Handler Tool to pickup Deformers in Camera View";
			
			this.ui.sNodeBox.nodeDisplayArea.setText( message );
		},


		//------------------------------------ Callbacks/Mouse Events during User Interaction ------------------------------------>


		deformersData: null,
		currentFrame: null,
		selectedDrawing: "",
		drawingMatrix: {},
		
		
		onCreate: function( ctx )
		{
			ctx.dragData = [];
			ctx.dragData_tool = [];
			ctx.snapStartCircle = [];
			ctx.snapEndCircle = [];
			
			ctx.yellow = { r: 255, g: 255, b: 0, a: 255 };
			ctx.green = { r: 0, g: 255, b: 0, a: 255 };
			ctx.red = { r: 255, g: 0, b: 0, a: 255 };
			
			ctx.overlay = {};			
			ctx.overlay.paths = [];
			ctx.overlay.paths.push( { path: ctx.dragData, color: ctx.yellow } );
			ctx.overlay.paths.push( { path: ctx.snapStartCircle, color: ctx.yellow } );				
			ctx.overlay.paths.push( { path: ctx.snapEndCircle, color: ctx.yellow } );
		},
		

		onMouseDown: function( ctx )
		{	
			if( this.deformersData == null )
				return false;

			ctx.dragData.length = 0;
			ctx.dragData_tool.length = 0;
			ctx.snapStartCircle.length = 0;			
			ctx.snapEndCircle.length = 0;
			
			ctx.overlay.paths.length = 3; //clear arrows
			CL.drawDirectionalArrows( ctx, this.drawingMatrix, this.options.cameraViewScale, this.deformersData );
			
			var cursorPath = specialFolders.resource + "/cursors";
			if( KeyModifiers.IsAlternatePressed() && KeyModifiers.IsShiftPressed() )	
			{
				ctx.mode = "reset";
				ctx.overlay.paths[0].color = ctx.red;	
				var lassoPix = new QPixmap( cursorPath + "/select_lasso.png" );			
				QApplication.setOverrideCursor( new QCursor( lassoPix, 4, 15 ) );
			}
			else
			{
				ctx.mode = "main";				
				ctx.overlay.paths[0].color = ctx.yellow;
				var crosshairPix = new QPixmap( cursorPath + "/precisecursor.png" );			
				QApplication.setOverrideCursor( new QCursor( crosshairPix, 8, 8 ) );
				this.options.pointByDist = {};
			}			
				
			return true;
		},
		
		
		onMouseMove: function( ctx )
		{
			ctx.dragData.push( { x: ctx.currentPoint.x, y: ctx.currentPoint.y } );
			
			if( ctx.mode == "main" )
			{
				ctx.dragData_tool.push( this.drawingMatrix.multiply( Point3d( ctx.currentPoint.x /1875, ctx.currentPoint.y /1875, 0 ) ) );	
				
				// draw circles to indicate points on deformer dragData's start/end points snap to
				if( this.options.allowSnapStart && ctx.dragData.length == 1  )
				{
					SI.detectSnappedPoints( ctx.dragData_tool[0], this.deformersData, this.options, "quickCheckStart" );
					if( this.options.snapStartPoint )
						CL.drawSnapCircle( ctx, this.drawingMatrix, this.options, this.deformersData, "start" );
				}
				else if( this.options.allowSnapEnd && ctx.dragData.length > 1 )
				{
					ctx.snapEndCircle.length = 0;
					SI.detectSnappedPoints( ctx.dragData_tool[ctx.dragData_tool.length -1], this.deformersData, this.options, "quickCheckEnd" );	
					if( this.options.snapEndPoint )
						CL.drawSnapCircle( ctx, this.drawingMatrix, this.options, this.deformersData, "end" );
				}	
			}
			return true;
		},
		
		
		onMouseUp: function( ctx )
		{
			if( ctx.mode == "reset" )
				ctx.dragData_tool = CL.applyDrawingMatrixToDragData( ctx.dragData, this.drawingMatrix );
		
			this.deformersData = ( ctx.mode == "main" ) ?
				DS.updateDeformers( ctx.dragData_tool, this.deformersData, this.options ):
				DS.resetDeformers( ctx.dragData_tool, this.deformersData );

			ctx.overlay.paths.length = 3; //clear arrows
			CL.drawDirectionalArrows( ctx, this.drawingMatrix, this.options.cameraViewScale, this.deformersData );
			
			QApplication.restoreOverrideCursor();
			ctx.dragData.length = 0;
			ctx.dragData_tool.length = 0;
			ctx.snapStartCircle.length = 0;	
			ctx.snapEndCircle.length = 0;
			
			return true;
		},
		
		
		onResetTool: function( ctx )
		{
			// this will be called before and after mouse events/pushing ALT key		
			QApplication.restoreOverrideCursor();		
			ctx.dragData.length = 0;
			ctx.dragData_tool.length = 0;
			ctx.snapStartCircle.length = 0;	
			ctx.snapEndCircle.length = 0;
			this.refreshDeformerRegistration( ctx );
		},
		
		
		refreshDeformerRegistration: function( ctx )
		{
			var fr = frame.current();
			var sNode = selection.selectedNodes(0);

			if( node.type( sNode ) !== "READ" || !node.getEnable( sNode ) )
				return;
		
			this.deformersData = DP.pickDeformersOfSelectedDrawing( sNode, fr );
			this.refreshNodeDisplay();			
			this.selectedDrawing = sNode;
			this.currentFrame = fr;
			
			DrawingTools.setCurrentDrawingFromNodeName( this.selectedDrawing, this.currentFrame );		
			this.drawingMatrix = node.getMatrix( this.selectedDrawing, this.currentFrame );
			this.options.cameraViewScale = CL.getCameraViewScale();		

			// changes made on ctx.overlay only get reflected on strokes during mouse events, schedule to draw arrows onMouseDown
			ctx.overlay.paths.length = 3; //clear arrows
		}
	}
	
	Tools.registerTool( toolDefinition );
}



exports.toolConfig = toolConfig();
exports.registerTool = registerTool;