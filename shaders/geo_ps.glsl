#extension GL_OES_standard_derivatives : enable

uniform vec2 resolution;
uniform float time;
uniform vec3 ambientLightColor;
uniform float roughnessScale;
uniform float diffuseScale;
uniform float fogScale;
uniform float ambientScale;

#if MAX_DIR_LIGHTS > 0
    uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];
    uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];
#endif

#if MAX_POINT_LIGHTS > 0
    uniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];
    uniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];
    varying vec4 vPointLight[ MAX_POINT_LIGHTS ];
#endif

#ifdef USE_SHADOWMAP
	uniform sampler2D shadowMap[ MAX_SHADOWS ];
	uniform vec2 shadowMapSize[ MAX_SHADOWS ];
	uniform float shadowDarkness[ MAX_SHADOWS ];
	uniform float shadowBias[ MAX_SHADOWS ];
	varying vec4 vShadowCoord[ MAX_SHADOWS ];
	float unpackDepth( const in vec4 rgba_depth ) 
	{
		const vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );
		float depth = dot( rgba_depth, bit_shift );
		return depth;
	}
#endif

#define stepSize 0.00024414062

uniform sampler2D heightmap;

uniform sampler2D diffusemap;
uniform sampler2D normalmap;
uniform sampler2D specmap;
uniform sampler2D aomap;

uniform sampler2D detaildiffuseone;
uniform sampler2D detailnormalone;
uniform sampler2D detailspecone;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

varying vec3 vTangent;
varying vec3 vBinormal;
varying vec3 vMappedPosition;

#define saturate( value ) clamp( value, 0.0, 1.0 )
#define lerp( x, y, a ) mix( x, y, a )
#define Pi 3.14159
#define OneOverPi 0.318310
#define sqr(x) pow( x, 2.0 )

float CalculateGGX( float roughness, float cosThetaM )
{
    float CosSquared = cosThetaM * cosThetaM;
    float alpha = roughness * roughness;
    float GGX = CosSquared * ( alpha - 1.0 ) + 1.0;
    return ( alpha ) / ( Pi * GGX * GGX );

    //float TanSquared = ( 1.0 - CosSquared ) / CosSquared;
   // return ( 1.0 / Pi ) * sqr( alpha / ( CosSquared * ( alpha * alpha + TanSquared ) ) );
}

float CalculateGeometric( float n_dot_x, float roughness )
{
	//return 1.0 / ( n_dot_x + sqrt( roughness + ( 1.0 - roughness ) * n_dot_x * n_dot_x ) );
    return n_dot_x / ( n_dot_x * ( 1.0 - roughness ) + roughness );
}

float CalculateGeometricAtten( float n_dot_l, float n_dot_v, float roughness )
{
    float roughnessRemap = roughness * 0.5; //0.5 + 
    //roughnessRemap *= roughnessRemap;
    //roughnessRemap *= 0.125;

    float atten = CalculateGeometric( n_dot_v, roughnessRemap ) * CalculateGeometric( n_dot_l, roughnessRemap );
    return atten;
}

float Fresnel( float x, float y, float z )
{
	return x + ( z - x ) * pow( 1.0 - y, 5.0 );
    //return pow( x + ( z - x ), -6.0 * y );
}

float CalculateLambert( float h_dot_d, float n_dot_v, float n_dot_l, float roughness )
{
		float frk = 0.5 + 2.0 * h_dot_d * h_dot_d * roughness;        
	return Fresnel( 1.0, n_dot_v, frk ) * Fresnel( 1.0, n_dot_l, frk );
}

float ScatterTerm( float term, float scattering )
{
    float fullTerm = max( term, 0.0 );
    float halfTerm = max( 0.5 * term + 0.5, 0.0 );
    return lerp( fullTerm, halfTerm, scattering );
}

vec3 CalculatePBRLighting( vec3 diffuse, float scattering, float roughness, float SRNI, float specular, vec3 normal, float n_dot_v, vec3 lightDirection, vec3 viewPosition, float n_dot_l )
{
	float scattered_n_dot_l = ScatterTerm( n_dot_l, scattering );
	if( scattered_n_dot_l < 0.005 )
		return vec3( 0.0 );

    vec3 halfVector = normalize( lightDirection + viewPosition );

    float h_dot_n = ScatterTerm( dot( halfVector, normal ), scattering );
    float h_dot_v = ScatterTerm( dot( halfVector, viewPosition ), scattering );
    float h_dot_d = ScatterTerm( dot( halfVector, lightDirection ), scattering );

    float fresnel = Fresnel( SRNI, h_dot_v, 1.0 );

    float distribution = CalculateGGX( roughness, h_dot_n );
    float geometricAttenuation = CalculateGeometricAtten( scattered_n_dot_l, h_dot_v, roughness );
    float specFinal = max( distribution * fresnel * geometricAttenuation * saturate( 1.0 / ( 4.0 * scattered_n_dot_l * n_dot_v ) ), 0.0 ) * specular;

    vec3 lambert = OneOverPi * diffuse;// * max( CalculateLambert( h_dot_d, n_dot_v, scattered_n_dot_l, 1.0 - roughness ), 0.0 );
    return scattered_n_dot_l * ( lambert + specFinal );
}

vec3 fuseNormals( vec3 firstNormal, vec3 secondNormal, float interp )
{
    vec3 partialDerivative = vec3( lerp( firstNormal.xy, firstNormal.xy + secondNormal.xy, interp ), firstNormal.z  * secondNormal.z );
    return normalize( partialDerivative );
}


vec3 filterNormal( vec2 uv, float texelSize ) 
{ 
	vec4 h; 
	h.x = texture2D( heightmap, uv + texelSize * vec2( 0.0,-1.0 ) ).r * 250.0; 
	h.y = texture2D( heightmap, uv + texelSize * vec2(-1.0, 0.0 ) ).r * 250.0; 
	h.z = texture2D( heightmap, uv + texelSize * vec2( 1.0, 0.0 ) ).r * 250.0; 
	h.w = texture2D( heightmap, uv + texelSize * vec2( 0.0, 1.0 ) ).r * 250.0; 

	vec3 n; 
	n.y = h.x - h.w; 
	n.x = h.y - h.z; 
	n.z = 2.0;//h.z - h.y; 

	return normalize( n ); 
}

float sampleHeightDistance( vec3 pos )
{
	return max( pos.y - texture2D( heightmap, pos.xz ).x, 0.0 );
}

float sampleOcclusion( in vec3 rayOrigin )
{
	float stepSizeFixed = stepSize * 20.0;
	float occlusion = 1.0; 
	occlusion -= saturate( texture2D( heightmap, rayOrigin.xz + stepSizeFixed * vec2( 0.0,-1.0 ) ).r - rayOrigin.y ) * 20.0; 
	occlusion -= saturate( texture2D( heightmap, rayOrigin.xz + stepSizeFixed * vec2(-1.0, 0.0 ) ).r - rayOrigin.y ) * 20.0;
	occlusion -= saturate( texture2D( heightmap, rayOrigin.xz + stepSizeFixed * vec2( 1.0, 0.0 ) ).r - rayOrigin.y ) * 20.0;
	occlusion -= saturate( texture2D( heightmap, rayOrigin.xz + stepSizeFixed * vec2( 0.0, 1.0 ) ).r - rayOrigin.y ) * 20.0;
	return occlusion;
}

float marchShadow( in vec3 rayOrigin, in vec3 rayDirection, float softness )
{
	float stepSizeFinal = 1.0;
    float result = 1.0;
    float march = 0.0;
    for( int i = 0; i < 512; i++ ) // Setting limit to 512 seems to prevent unrolling
    {
    	vec3 point = rayDirection * march;
        if( point.y > 0.25 ) // Modification for Heightmaps, so it doesn't march off the terrain
            return result;

        float height = sampleHeightDistance( rayOrigin + point );

        if( height < 0.001 )
            return 0.0;

        result = min( result, softness * height / march );
        march += max( height, 0.00125 );
    }
    return result;
}

void main()	
{
    vec2 detailMainUV = vUv * 5.25;
    vec2 detailSecondaryUV = detailMainUV * 2.462;
    vec2 detailTertiaryUV = detailMainUV * 0.25;

    // Sampling

    float height = texture2D( heightmap, vUv ).x;

    float specSample = 0.5 + texture2D( specmap, vUv ).x * 0.5;
    float detailSpecular = texture2D( detailspecone, detailTertiaryUV ).x * 
        ( texture2D( detailspecone, detailMainUV ).x + texture2D( detailspecone, detailSecondaryUV ).x ) * 0.5;

    vec3 diffuseSample = vec3( texture2D( diffusemap, vUv ).b );
    float detailDiffuseoneSample = texture2D( detaildiffuseone, detailMainUV ).r;
    float detailDiffusetwoSample = texture2D( detaildiffuseone, detailSecondaryUV ).r;
    float detailDiffusethreeSample = texture2D( detaildiffuseone, detailTertiaryUV ).r;

    vec3 normalmapSamplePrimary = texture2D( normalmap, vUv ).xyz * 2.0 - 1.0;
    vec3 normalmapSampleSecondary = texture2D( detailnormalone, detailMainUV ).xyz * 2.0 - 1.0;
    vec3 normalmapSampleThird = texture2D( detailnormalone, detailSecondaryUV ).xyz * 2.0 - 1.0;

    float ao = texture2D( aomap, vUv ).x;

    // Terms

    float roughness = clamp( specSample * ( 0.325 + detailSpecular * 0.675 ), 0.125, 1.0 ) * roughnessScale;
    float detailDiffuse = detailDiffusethreeSample * ( detailDiffuseoneSample + detailDiffusetwoSample ) * 0.5;
    vec3 diffuse = lerp( diffuseSample, detailDiffuse * diffuseSample, specSample ) * diffuseScale;

    float scattering = 0.0;// * specSample;
    float ior = 1.5;// + specSample * 0.425;
    float SRNI = pow( ( ior - 1.0 ) / ( ior + 1.0 ), 2.0 );
    float specular = ( 0.5 + ao * 0.5 );

    // Normal Mapping

    mat3 tsb = mat3( vTangent, vBinormal, vNormal );

    float fuseDegree = 0.5 + ( 1.0 - roughness ) * 0.5;
    vec3 firstFuse = fuseNormals( normalmapSamplePrimary, normalmapSampleSecondary, 1.0 );
    vec3 finalNormal = tsb * fuseNormals( normalmapSamplePrimary, firstFuse, fuseDegree );

    vec3 normal = normalize( finalNormal );//normalize( vNormal );
    vec3 viewPosition = normalize( vViewPosition );

    float n_dot_v = max( dot( normal, viewPosition ), 0.0 );

    // Ambient Lighting
    vec3 lightAccumulation = vec3( 0.0 );

    vec3 skyLightDirection = ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz;
    float skyLight = dot( normal, skyLightDirection );
    lightAccumulation += ( CalculatePBRLighting( diffuse, 1.0, roughness, SRNI, specular,
        normal, n_dot_v, skyLightDirection, viewPosition, skyLight ) * ambientScale * ao ) * vec3(0.975,0.9875,1.0);

    vec3 sunDirection = vec3( 0.0, 0.0, 1.0 );
    vec3 sunAccumulation = vec3( 0.0 );
    float sunShadowTerm = 1.0;

    #if MAX_DIR_LIGHTS > 0
        //for( int i = 0; i < MAX_DIR_LIGHTS; i++ ) 
        //{
            vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ 0 ], 0.0 );
            vec3 dirVector = normalize( lDirection.xyz );
            sunDirection = directionalLightDirection[ 0 ];

			float n_dot_l = dot( dirVector, normal );
            sunAccumulation = directionalLightColor[0].xyz * CalculatePBRLighting( diffuse, scattering, roughness, SRNI, specular, normal, n_dot_v, dirVector, viewPosition, n_dot_l );
        //}

        vec3 tLdir = normalize( vec3( sunDirection.x, sunDirection.y, -sunDirection.z ) );
        vec3 rayOrigin = vec3( vUv.x, height, vUv.y );
        sunShadowTerm = saturate( marchShadow( vec3( vUv.x, height + 0.0325, vUv.y ), tLdir, 8.0 ) );
        lightAccumulation += sunAccumulation * vec3( sunShadowTerm );
    #endif

    #if MAX_POINT_LIGHTS > 0
        for( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) 
        {
        	vec3 pointVector = ( viewMatrix * vec4( pointLightPosition[ i ], 1.0 ) ).xyz + vViewPosition.xyz;
            vec3 pointDirection = normalize( pointVector );
            float pointDistance = length( pointVector ) * 0.00125;

            float falloff = saturate( 1.0 - pow( pointDistance / 4.0, 4.0 ) );
            falloff *= falloff;
            falloff /= ( pointDistance * pointDistance ) + 1.0;

			float n_dot_l = dot( pointDirection, normal );
            lightAccumulation += pointLightColor[i].xyz * CalculatePBRLighting( diffuse, scattering, roughness, SRNI, specular,
            	normal, n_dot_v, pointDirection, viewPosition, n_dot_l ) * falloff;
        }
    #endif

    float depth = gl_FragCoord.z / gl_FragCoord.w;

	const float LOG2 = 1.442695;
	float fogDensity = 0.000125 * fogScale;

	float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
	fogFactor = 1.0 - saturate( fogFactor );

	float sunAmount = max( dot( viewPosition, -sunDirection ), 0.0 );
	vec3  fogColor  = lerp( 0.75 * vec3(0.975,0.9875,1.0), // bluish
	                       vec3(1.0,0.9875,0.975), // yellowish
	                       pow(sunAmount,8.0) );
	lightAccumulation = lerp( lightAccumulation, fogColor, fogFactor );

    lightAccumulation = pow( lightAccumulation, vec3( 0.45454545 ) );
    gl_FragColor = vec4( lightAccumulation, 1.0 );
}