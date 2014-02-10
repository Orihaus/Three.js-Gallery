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

THREE.OZMLMaterial = function( material, buffer )
{
    this.Material = material;
    this.GeometryBuffer = buffer;
    this.CurrentLength = 0;
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
       var index;
       for (index = 0; index < _this.ObjectStack.length; index++)
       {
           var m2 = mesh.clone();
           _this.ObjectStack[index](m2);
       }
    }

    this.url = inUrl;
    this.ObjectStack = new Array();
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
		var bufferGeometry = new THREE.BufferGeometry();
		bufferGeometry.attributes =
        {
            position: {
                itemSize: 3,
                array: new Float32Array(218450 * 3 * 3)
            },
            normal: {
                itemSize: 3,
                array: new Float32Array(218450 * 3 * 3)
            },
            uv: {
                itemSize: 2,
                array: new Float32Array(218450 * 3 * 2)
            }
        }
		bufferGeometry.dynamic = true;

		_this.materialLibrary[attributes.name.value] = new THREE.OZMLMaterial(newMaterial, bufferGeometry);
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
		            threeObject.add(new THREE.Mesh(object, material));

		            /*var bufferGeometry = _this.materialLibrary[obj.Material].GeometryBuffer;

		            var mesh = new THREE.Mesh(bufferGeometry, material);
		            if (_this.materialLibrary[obj.Material].CurrentLength == 0) _this.scene.add(mesh);

		            object.applyMatrix(new THREE.Matrix4().makeScale(threeObject.scale.x, threeObject.scale.y, threeObject.scale.z));
		            object.applyMatrix(new THREE.Matrix4().makeRotationX(threeObject.rotation.x));
		            object.applyMatrix(new THREE.Matrix4().makeRotationY(threeObject.rotation.y));
		            object.applyMatrix(new THREE.Matrix4().makeRotationZ(threeObject.rotation.z));
		            object.applyMatrix(new THREE.Matrix4().makeTranslation(threeObject.position.x, threeObject.position.y, threeObject.position.z));

		            object.verticesNeedUpdate = true;

		            bufferGeometry = THREE.BufferGeometryUtils.fromGeometry(bufferGeometry, _this.materialLibrary[obj.Material].CurrentLength, object);
		            _this.materialLibrary[obj.Material].CurrentLength += object.faces.length;*/
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