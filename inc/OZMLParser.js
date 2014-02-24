/**
 * @author orihaus / http://noctuelles.net/
 */

THREE.OZMLObject = function () 
{
	this.Name = "Unnamed";
	this.Position;
	this.Rotation;
	this.Size;
	this.Material =  "";
	this.Layer = "Default";
	this.Type = "Cube";
	this.ParentName = "";

	this.Source = "";
}

THREE.OZMLMaterial = function( material )
{
    this.Material = material;
    this.GeometryBuffers = [];
    this.CurrentLengths = [];
    this.Meshes = [];
}

THREE.MeshAssemblage = function( inUrl ) 
{
    var _this = this;

    this.PushCallback = function( callback )
    {
        _this.ObjectStack.push(callback);
    }

    this.Loaded = function( mesh )
    {
       for (var index = 0; index < _this.ObjectStack.length; index++)
       {
           var m2 = mesh.clone();
           _this.ObjectStack[index](m2);
       }
    }

    this.url = inUrl;
    this.ObjectStack = [];
    this.loading = false;
}

THREE.OZMLParser = function ( inUrl, inScene, inMaterial ) 
{
	var _this = this;

	this.url = inUrl;
	this.title = "";
	this.parseList = {};
	this.objects = {};
	this.scene = inScene;
	this.objLoader = new THREE.OBJLoader();
	this.baseMaterial = inMaterial;
	this.materialLibrary = {};
	this.meshLibrary = {};

	function ParseChildren( node )
	{
		//console.log( node.nodeName );
		for( var i = 0; i < node.children.length; i++ )
  		{
  			var child = node.children[i];
  			if( _this.parseList[child.nodeName] )
  				_this.parseList[child.nodeName]( child, node );
  			ParseChildren( node.children[i] );
  		}
	}

	function ParseVector( instr )
	{
		var str = instr.replace( /\s+/g, '' );
		var vec = str.split(",").map( parseFloat );
		return new THREE.Vector3( vec[0], vec[1], vec[2] );
	}

	function ImageExists(url, callback) {
	    var img = new Image();
	    img.onload = function () { callback(true); };
	    img.onerror = function () { callback(false); };
	    img.src = url;
	}

	this.ParseMaterial = function( node, parent )
	{
		var attributes = node.attributes;
		var newMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaaaa  });//shading: THREE.FlatShading });
		if( attributes.texture )
		{
		    //if( ImageExists( attributes.texture.value ) )
		    //{
		        newMaterial.map = THREE.ImageUtils.loadTexture( attributes.texture.value, THREE.UVMapping,  function ( texture ) 
		        {
		            texture.minFilter = THREE.NearestFilter;
		            texture.magFilter = THREE.NearestFilter;
		        });
		    //}
		}

		newMaterial.transparent = true;

	    // Buffer
		//bufferGeometry.dynamic = true;

		_this.materialLibrary[attributes.name.value] = new THREE.OZMLMaterial(newMaterial);
		console.log( "Reading material: " + attributes.name.value );
	}

	this.ParseMesh = function (node, parent)
	{
	    var attributes = node.attributes;

	    _this.meshLibrary[attributes.name.value] = new THREE.MeshAssemblage( attributes.url.value );
	    /*_this.objLoader.load( attributes.url.value, function( object )
	    {
	        ObjectStack.traverse( function( stackedObject )
	        {
	            stackedObject.add( object );
	        });
	    });*/

		console.log( "Read Mesh: " + attributes.name.value );
	}

	this.ParseObject = function( node, parent )
	{	
		var attributes = node.attributes;
		var obj = new THREE.OZMLObject();
		var threeObject = new THREE.Object3D();

		obj.Size = new THREE.Vector3( 1.0, 1.0, 1.0 );
		if( parent.attributes.name )
		{
			obj.ParentName = parent.attributes.name.value;
			//if( parent.nodeName == "mesh" )
			//	obj.Size.multiply( parent.attributes.size.value );
		}

		if( attributes.name )
			obj.Name = attributes.name.value;
		if( attributes.position )
			obj.Position = ParseVector( attributes.position.value );
		if( attributes.rotation )
			obj.Rotation = ParseVector( attributes.rotation.value );
		if( attributes.scale )
		    obj.Size = ParseVector(attributes.scale.value);

		var material = _this.baseMaterial;
		if( attributes.material )
		{
			obj.Material = attributes.material.value;
			material = _this.materialLibrary[obj.Material].Material;
		}

		if( attributes.layer )
			obj.Layer = attributes.layer.value;

		obj.Type = node.nodeName;

		threeObject.scale.set( obj.Size.x, obj.Size.y, obj.Size.z );
		threeObject.position.set(obj.Position.x, obj.Position.y, obj.Position.z);
		if (attributes.rotation)
		    threeObject.rotation.set(obj.Rotation.x * 0.0174532925, obj.Rotation.y * 0.0174532925, obj.Rotation.z * 0.0174532925);

		//threeObject.castShadow = true;
		//threeObject.receiveShadow = true;

		//if( obj.Type == "cube" )
		//{
			/*_this.objLoader.load( 'data/DrypointCube.obj', function ( object ) 
			{
				object.traverse( function ( child ) 
				{
					if( child instanceof THREE.Mesh )
					{
						child.material = material;
					}
				} );

				object.scale.set( 5.4, 5.4, 5.4 );
				object.material = material;
				threeObject.add( object );
			} );*/
		//}

		if( obj.Type == "meshInstance" )
		{
		    if (_this.meshLibrary[attributes.mesh.value])
		    {
		        if( !_this.meshLibrary[attributes.mesh.value].loading )
		        {
		            _this.objLoader.load(_this.meshLibrary[attributes.mesh.value].url, function (object)
		            {
		                object.traverse(function (child) {
		                    if (child instanceof THREE.Mesh)
		                    	_this.meshLibrary[attributes.mesh.value].Loaded( child.geometry );
		                } );
		            });

		            _this.meshLibrary[attributes.mesh.value].loading = true;
		        }

		        _this.meshLibrary[attributes.mesh.value].PushCallback( function (object)
		        {
		            object.applyMatrix(new THREE.Matrix4().makeScale(threeObject.scale.x, threeObject.scale.y, threeObject.scale.z));
		            object.applyMatrix(new THREE.Matrix4().makeRotationX(threeObject.rotation.x));
		            object.applyMatrix(new THREE.Matrix4().makeRotationY(threeObject.rotation.y));
		            object.applyMatrix(new THREE.Matrix4().makeRotationZ(threeObject.rotation.z));
		            object.applyMatrix(new THREE.Matrix4().makeTranslation(threeObject.position.x, threeObject.position.y, threeObject.position.z));
		            object.verticesNeedUpdate = true;

		            // Append to buffer
		            
		            var materialStore =  _this.materialLibrary[obj.Material];

		        	var currentBuffer = materialStore.GeometryBuffers.length - 1;
		            var currentOffset = ( currentBuffer > -1 ) ? materialStore.CurrentLengths[currentBuffer] : 0;
		            var firstAppend = false;

		            //console.log( currentOffset + object.faces.length);
		            var bufferSize = 5000;//21845;
		            if( currentOffset + object.faces.length > bufferSize || currentBuffer == -1 )
		            {
		            	if( currentBuffer > -1 )
		            		console.log( "Splitting buffer #" + currentBuffer + " at: " + currentOffset );

		            	currentBuffer++;
		            	currentOffset = 0;

						var bufferGeometryNew = new THREE.BufferGeometry();
						bufferGeometryNew.attributes =
				        {
							/*index: {
								itemSize: 1,
								array: new Uint16Array( bufferSize * 3 ),
								numItems: bufferSize * 3
							},*/
				            position: {
				                itemSize: 3,
				                array: new Float32Array(bufferSize * 3 * 3),
				                numItems: bufferSize * 3 * 3
				            },
				            normal: {
				                itemSize: 3,
				                array: new Float32Array(bufferSize * 3 * 3),
				                numItems: bufferSize * 3 * 3
				            },
				            uv: {
				                itemSize: 2,
				                array: new Float32Array(bufferSize * 3 * 2),
				                numItems: bufferSize * 3 * 2
				            }
				        }
				        bufferGeometryNew.dynamic = true;

						/*var chunkSize = 2000;
						var indices = bufferGeometryNew.attributes.index.array;
						for ( var i = 0; i < indices.length; i ++ )
								indices[ i ] = i % ( 3 * chunkSize );

						bufferGeometryNew.offsets = [];
						var offsets = bufferSize / chunkSize;
						for ( var i = 0; i < offsets; i ++ ) 
						{
							var bufferOffset = {
								start: ( i * chunkSize  * 3 ),
								index: ( i * chunkSize  * 3 ),
								count: Math.min( bufferSize - ( i * chunkSize ), chunkSize ) * 3
							};

							bufferGeometryNew.offsets.push( bufferOffset );
						}*/

		            	materialStore.CurrentLengths.push( 0 );
		            	materialStore.GeometryBuffers.push( bufferGeometryNew );

		            	firstAppend = true;
		            }

		            var bufferGeometry = materialStore.GeometryBuffers[currentBuffer];
		            bufferGeometry = THREE.BufferGeometryUtils.fromGeometry(bufferGeometry, currentOffset, object);
		            materialStore.CurrentLengths[currentBuffer] += object.faces.length;

		            if (firstAppend)
	            	{
	            		materialStore.Meshes.push( new THREE.Mesh(bufferGeometry, material) );
	             		_this.scene.add(materialStore.Meshes[currentBuffer]);
	             	}

	             	materialStore.Meshes[currentBuffer].geometry.verticesNeedUpdate = true;

		            // console.log(_this.materialLibrary[obj.Material].CurrentLength);
		        });
		    }
		}

		_this.scene.add( threeObject );
		_this.objects[obj.Name] = obj;

		//console.log( obj );
	}

	function ParseOZML( node )
	{
		ParseChildren( node );
	}

	function Init()
	{
	    _this.parseList["material"] = _this.ParseMaterial;
	    _this.parseList["mesh"] = _this.ParseMesh;
		_this.parseList["meshInstance"] = _this.ParseObject;
		_this.parseList["cube"] = _this.ParseObject;

		var Connect = new XMLHttpRequest();
		Connect.open( "GET", _this.url, false );
		Connect.setRequestHeader( "Content-Type", "text/xml" );
		Connect.send( null );

		var OZML = Connect.responseXML;
		ParseOZML( OZML.children[0] );
	}

	Init()
};