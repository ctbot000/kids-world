/*! three.js r186 add-on | MIT License | https://threejs.org */
import{FXAAShader as s}from"../shaders/FXAAShader.js";import{ShaderPass as r}from"./ShaderPass.js";class e extends r{constructor(){super(s)}setSize(s,r){this.material.uniforms.resolution.value.set(1/s,1/r)}}export{e as FXAAPass};
