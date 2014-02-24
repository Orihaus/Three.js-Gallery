/**
 * @author orihaus / http://noctuelles.net/
 */

THREE.GeoTile = function( inUniform, inMaterial, inMesh ) 
{
	this.uniforms = inUniform;
	this.material = inMaterial;
	this.mesh = inMesh;
}

THREE.Geo = function ( inUrl, inScene, inCount ) 
{
	var _this = this;

	this.url = inUrl;
	this.scene = inScene;
	this.baseMaterial;
	this.resolution = 256;
	this.tileCount = inCount;

	this.pixelShader;
	this.vertexShader;
	this.vertexShaderLoaded = false;
	this.pixelShaderLoaded = false;

	this.tileArray = [];

	function AddMeshToScene( geometry, scale, x, y, z, rx, ry, rz, material ) 
	{
		mesh = new THREE.Mesh( geometry, material );
		mesh.scale.set( scale, scale, scale );
		mesh.position.set( x, y, z );
		mesh.rotation.set(rx * 0.0174532925, ry * 0.0174532925, rz * 0.0174532925);

		mesh.castShadow = true;
		mesh.receiveShadow = true;

		geometry.computeTangents();

		_this.scene.add( mesh );

		return mesh;
	}

	function InitTexture( url )
	{
		var texture = THREE.ImageUtils.loadTexture( url );
		//texture.minFilter = THREE.LinearFilter;
		//texture.magFilter = THREE.LinearMipMapLinearFilter;
		texture.anisotropy = 16;
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
		return texture;
	}

	function GetImageURL( type, x, y )
	{
		var tileInfo = "";

		if( _this.tileCount > 1 )
			tileInfo = "_x" + x + "_y" + y;

		return _this.url + type + tileInfo + "_Compressed.jpg";
	}

	function CreateTile( x, y )
	{
		var currentUniform = THREE.UniformsUtils.merge( [
			THREE.UniformsLib["lights"], THREE.UniformsLib["fog"], THREE.UniformsLib[ "shadowmap" ],
			{
				roughnessScale: { type: "f", value: 1.0 },
				diffuseScale: { type: "f", value: 1.0 },
				fogScale: { type: "f", value: 0.625 },
				ambientScale: { type: "f", value: 0.625 },

			    heightmap: { type: "t", value: false },                                            	

			    diffusemap: { type: "t", value: false },
			    specmap: { type: "t", value: false },
			    aomap: { type: "t", value: false },
			    normalmap: { type: "t", value: false },

			    detaildiffuseone: { type: "t", value: false },
			    detailnormalone: { type: "t", value: false },
			    detailspecone: { type: "t", value: false }
			}]);

		// Load Images
		console.log( "Loading Images for Tile: " + x + ":" + y );
	    currentUniform.heightmap.value = InitTexture( GetImageURL( "Heightmap", x, y ) );
	    currentUniform.heightmap.value.wrapS = currentUniform.heightmap.value.wrapT = THREE.ClampToEdgeWrapping;

	    currentUniform.diffusemap.value = InitTexture( GetImageURL( "Diffusemap", x, y ) );
	    currentUniform.specmap.value = InitTexture( GetImageURL( "Roughnessmap", x, y ) );
	    currentUniform.normalmap.value = InitTexture( GetImageURL( "Normalmap", x, y ) );
	    currentUniform.aomap.value = InitTexture( GetImageURL( "Occlusionmap", x, y ) );

	    currentUniform.detaildiffuseone.value = InitTexture("data/Frost/Shared/pk02_sand01_D.jpg");
	    currentUniform.detailnormalone.value = InitTexture("data/Frost/Shared/pk02_sand01_N.jpg");
	    currentUniform.detailspecone.value = InitTexture("data/Frost/Shared/pk02_sand01_S.jpg");

	   	// Init Material
		var currentMaterial = new THREE.ShaderMaterial({
			uniforms: currentUniform,
			vertexShader: vertexShader,
			fragmentShader: pixelShader,
			// shading: THREE.FlatShading,
			lights: true
		});

		var plane = new THREE.PlaneGeometry( 10.0, 10.0, _this.resolution, _this.resolution );
		var currentMesh = AddMeshToScene( plane, 512, -5120 * x, -512, y * 5120, -90, 0, 0, currentMaterial );
		
		// Store Terrain
		var terrain = new THREE.GeoTile( currentUniform, currentMaterial, currentMesh );
		_this.tileArray.push( terrain );
	}

	function InitializeTerrains()
	{
		console.log( "Fabricating " + _this.url + " at " + _this.resolution + " resolution." );

		// Populate Arrays and Load Images
		for( var x = 0; x < _this.tileCount / 2; x++ )
		{
			for( var y = 0; y < _this.tileCount / 2; y++ )
			{
				CreateTile( x, y );
			}
		}
	}

	function loadShader( file, vertex ) 
	{
	    var cache, shader;

	    $.ajax({
	        async: false, // need to wait... todo: deferred?
	        url: "shaders/" + file, //todo: use global config for shaders folder?
	        success: function(result) {
	        	if( vertex )
	        	{
	        		_this.vertexShaderLoaded = true;
	        		vertexShader = result;
	        	}
	        	else
	        	{
	        		_this.pixelShaderLoaded = true;
	        		pixelShader = result;
	        	}

	        	if( _this.pixelShaderLoaded && _this.vertexShaderLoaded )
	        		InitializeTerrains();
	        }
	    });
	};

	function Init()
	{
	    // Load Shaders
	    loadShader("geo_vs.glsl", true);
	    loadShader("geo_ps.glsl", false);
	}

	Init();
};