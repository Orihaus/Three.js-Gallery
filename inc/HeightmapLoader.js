/**
 * @author orihaus / http://noctuelles.net/
 */

THREE.HeightmapLoader = function ( inUrl, inScene, inMaterial ) 
{
	var _this = this;

	this.url = inUrl;
	this.scene = inScene;
	this.baseMaterial = inMaterial;
	this.resolution = 256;

	function addMeshToScene( geometry, scale, x, y, z, rx, ry, rz, material ) 
	{
		mesh = new THREE.Mesh( geometry, material );
		mesh.scale.set( scale, scale, scale );
		mesh.position.set( x, y, z );
		mesh.rotation.set(rx, ry, rz);

		//mesh.castShadow = true;
		//mesh.receiveShadow = true;

		scene.add( mesh );
	}

	function getHeightData( img ) 
	{
	    var canvas = document.createElement( 'canvas' );
	    canvas.width = 2048;
	    canvas.height = 2048;
	    var context = canvas.getContext( '2d' );

	    context.drawImage( img, 0, 0 );

	    var size = _this.resolution * _this.resolution, data = new Float32Array( size );
	    for( var i = 0; i < size; i ++ )
	        data[i] = 0;

	    var imgd = context.getImageData( 0, 0, _this.resolution, _this.resolution );
	    var pix = imgd.data;

	    var j=0;
	    for( var i = 0, n = pix.length; i < n; i += (4) ) 
	    {
	        var all = pix[i] + pix[i+1] + pix[i+2];
	        data[j++] = all / 30;
	    }

	    return data;
	}

	function computeLockedFaceNormals( geo ) 
	{
		var cb = new THREE.Vector3(), ab = new THREE.Vector3();

		for ( var f = 0, fl = geo.faces.length; f < fl; f ++ ) 
		{
			var face = geo.faces[ f ];

			var vA = geo.vertices[ face.a ];
			var vB = geo.vertices[ face.b ];
			var vC = geo.vertices[ face.c ];

			cb.subVectors( vC, vB );
			ab.subVectors( vA, vB );
			cb.cross( ab );

			cb.normalize();

			face.normal.copy( new THREE.Vector3( 0.0, 1.0, 0.0 ) );
		}
	}

	function computeLockedVertexNormals( geo ) 
	{
		var v, vl, f, fl, face, vertices;
		if ( geo.__tmpVertices === undefined ) 
		{
			geo.__tmpVertices = new Array( geo.vertices.length );
			vertices = geo.__tmpVertices;

			for ( v = 0, vl = geo.vertices.length; v < vl; v ++ )
				vertices[ v ] = new THREE.Vector3();

			for ( f = 0, fl = geo.faces.length; f < fl; f ++ ) 
			{
				face = geo.faces[ f ];
				face.vertexNormals = [ new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3() ];
			}
		} else 
		{
			vertices = geo.__tmpVertices;
			for ( v = 0, vl = geo.vertices.length; v < vl; v ++ )
				vertices[ v ].set( 0, 0, 0 );
		}

		var vA, vB, vC, vD;
		var cA = new THREE.Vector3(), cB = new THREE.Vector3(),
			cC = new THREE.Vector3();
			var cb = new THREE.Vector3(), ab = new THREE.Vector3(),
				db = new THREE.Vector3(), dc = new THREE.Vector3(), bc = new THREE.Vector3();

		for ( f = 0, fl = geo.faces.length; f < fl; f ++ ) 
		{
			face = geo.faces[ f ];

			vA = geo.vertices[ face.a ];
			vB = geo.vertices[ face.b ];
			vC = geo.vertices[ face.c ];

			cA.copy( vA ); cB.copy( vB ); cC.copy( vC );
			cA.cross( cB ); cB.cross( cC ); cC.cross( cA );
			cb = cA.add( cB ); cb = cb.add( cC );

			//cb.subVectors( cC, cB );
			//ab.subVectors( cA, cB );
			//cb.cross( ab );
			
			console.log( cb );

			vertices[ face.a ].add( cb );
			vertices[ face.b ].add( cb );
			vertices[ face.c ].add( cb );
		}

		for ( v = 0, vl = geo.vertices.length; v < vl; v ++ )
			vertices[ v ].normalize();

		for ( f = 0, fl = geo.faces.length; f < fl; f ++ ) 
		{
			face = geo.faces[ f ];
			face.vertexNormals[ 0 ].copy( vertices[ face.a ] );
			face.vertexNormals[ 1 ].copy( vertices[ face.b ] );
			face.vertexNormals[ 2 ].copy( vertices[ face.c ] );
		}
	}

	function fabricateTerrain( heightmapImage, precomputedGeometry )
	{
		/*var data = getHeightData( heightmapImage );

		// plane
		geo = new THREE.PlaneGeometry( 75, 75, _this.resolution - 1, _this.resolution - 1 );
		geo.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );
		//geo.dynamic = true;
		//plane.rotation.x = -90;
		//plane.dynamic = true;

		for( var i = 0, l = geo.vertices.length; i < l; i ++ )
		{
			geo.vertices[i].y = Math.abs( perlin.noise( geo.vertices[i].x / 1, geo.vertices[i].y / 1, z ) * 1 * 1.75 );//data[i];
		}*/

		var geo = precomputedGeometry.geometry;

		geo.verticesNeedUpdate = true;
		//computeLockedVertexNormals( geo );
		//computeLockedNormals( geo );
		//geo.computeTangents();
		//geo.computeCentroids();

		//console.log( geo.vertices[0].position );

		addMeshToScene( geo, 10, 0, -320, 0, 0, 0, 0, _this.baseMaterial );//new THREE.MeshBasicMaterial( { color: 0x222222, wireframe: true} ) );
	}

	function Init()
	{
		console.log( "Fabricating " + _this.url + " at " + _this.resolution + " resolution." );

		var heightmapImage = new Image();
		heightmapImage.src = _this.url;

		/*heightmapImage.onload = function () 
		{
			fabricateTerrain( heightmapImage );
		};*/

		var objectLoader = new THREE.OBJLoader();
		objectLoader.load( 'data/Heightmap_04-L3.obj', function ( object ) 
		{
			object.traverse( function ( child ) 
			{
				if( child instanceof THREE.Mesh )
				{
					fabricateTerrain( heightmapImage, child );
				}
			} ) ;
		} );
	}

	Init();
};