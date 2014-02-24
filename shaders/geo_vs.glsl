attribute vec4 tangent;
uniform vec3 ambientLightColor;

#if MAX_POINT_LIGHTS > 0
    uniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];
    varying vec4 vPointLight[ MAX_POINT_LIGHTS ];
#endif

#ifdef USE_SHADOWMAP
	varying vec4 vShadowCoord[ MAX_SHADOWS ];
	uniform mat4 shadowMatrix[ MAX_SHADOWS ];
#endif

#define texelSize 0.00024414062

uniform sampler2D heightmap;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vMappedPosition;

varying vec3 vTangent;
varying vec3 vBinormal;

void main()	
{
    vec4 h;

    vec2 uvSample = uv + texelSize * vec2( 1.0, - 1.0 ) ;
    float avgHeight =  texture2D( heightmap, uvSample + texelSize * vec2( 0.0,-1.0 ) ).r; 
    avgHeight       += texture2D( heightmap, uvSample + texelSize * vec2(-1.0, 0.0 ) ).r; 
    avgHeight       += texture2D( heightmap, uvSample + texelSize * vec2( 1.0, 0.0 ) ).r; 
    avgHeight       += texture2D( heightmap, uvSample + texelSize * vec2( 0.0, 1.0 ) ).r;

    avgHeight       += texture2D( heightmap, uvSample ).x;
    avgHeight *= 0.2;

	float height = avgHeight * 4.25;
	vec4 mappedPosition = vec4( position.x, position.y, position.z + height, 1.0 );
    vec4 mvPosition = modelViewMatrix * mappedPosition;

	 	vNormal = normalize( normalMatrix * normal );
    vTangent = normalize( normalMatrix * tangent.xyz );
    vBinormal = cross( vNormal, vTangent ) * tangent.w;
    vBinormal = normalize( vBinormal );
    vMappedPosition = ( modelMatrix * mappedPosition ).xyz;

    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;

	#ifdef USE_SHADOWMAP
		for( int i = 0; i < MAX_SHADOWS; i ++ ) 
		{
			vShadowCoord[ i ] = shadowMatrix[ i ] * ( modelMatrix * mappedPosition );
		}
	#endif
}