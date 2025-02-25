import * as THREE from 'three';
import assert from 'assert';
import { updateLayeredMaterialNodeImagery, updateLayeredMaterialNodeElevation } from 'Process/LayeredMaterialNodeProcessing';
import FeatureProcessing from 'Process/FeatureProcessing';
import TileMesh from 'Core/TileMesh';
import Extent, { globalExtentTMS } from 'Core/Geographic/Extent';
import OBB from 'Renderer/OBB';
import DataSourceProvider, { supportedFetchers } from 'Provider/DataSourceProvider';
import TileProvider from 'Provider/TileProvider';
import WMTSSource from 'Source/WMTSSource';
import WMSSource from 'Source/WMSSource';
import WFSSource from 'Source/WFSSource';
import LayerUpdateState from 'Layer/LayerUpdateState';
import ColorLayer from 'Layer/ColorLayer';
import ElevationLayer from 'Layer/ElevationLayer';
import GeometryLayer from 'Layer/GeometryLayer';
import PlanarLayer from 'Core/Prefab/Planar/PlanarLayer';
import Feature2Mesh from 'Converter/Feature2Mesh';
import LayeredMaterial from 'Renderer/LayeredMaterial';

const holes = require('../data/geojson/holesPoints.geojson.json');

supportedFetchers.set('image/png', () => Promise.resolve(new THREE.Texture()));
supportedFetchers.set('application/json', () => Promise.resolve(holes));

// Mock document object for Mocha.
// Warning is overloaded by view test unit
global.document = {
    createElement: () => ({
        getContext: () => ({
            fillRect: () => { },
            moveTo: () => { },
            lineTo: () => { },
            beginPath: () => { },
            stroke: () => { },
            fill: () => { },
            arc: () => { },
            setTransform: () => { },
            canvas: { width: 256, height: 256 },
        }),
    }),
};

describe('Provide in Sources', function () {
    // Misc var to initialize a TileMesh instance
    const geom = new THREE.Geometry();
    geom.OBB = new OBB(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
    const globalExtent = globalExtentTMS.get('EPSG:3857');
    const zoom = 10;
    const sizeTile = globalExtent.dimensions().x / 2 ** zoom;
    const extent = new Extent('EPSG:3857', 0, sizeTile, 0, sizeTile);
    // const zoom = 4;
    const material = new LayeredMaterial();

    // Mock scheduler
    const context = {
        view: {
            notifyChange: () => true,
        },
        scheduler: {
            commands: [],
            execute: (cmd) => {
                context.scheduler.commands.push(cmd);
                return new Promise(() => { /* no-op */ });
            },
        },
    };

    const planarlayer = new PlanarLayer('globe', globalExtent, new THREE.Group());
    const colorlayer = new ColorLayer('color', { projection: 'WMTS:PM' });
    const elevationlayer = new ElevationLayer('elevation', { projection: 'WMTS:PM' });

    planarlayer.attach(colorlayer);
    planarlayer.attach(elevationlayer);

    material.addLayer(colorlayer);
    material.addLayer(elevationlayer);

    const nodeLayer = material.getLayer(colorlayer.id);
    const nodeLayerElevation = material.getLayer(elevationlayer.id);

    const featureLayer = new GeometryLayer('geom', new THREE.Group());
    featureLayer.update = FeatureProcessing.update;
    featureLayer.projection = 'EPSG:4978';
    featureLayer.mergeFeatures = false;
    function extrude() {
        return 5000;
    }

    function color() {
        return new THREE.Color(0xffcc00);
    }

    featureLayer.source = new WFSSource({
        url: 'http://',
        typeName: 'name',
        format: 'application/json',
        extent: globalExtent,
        projection: 'EPSG:3857',
        zoom: { min: zoom, max: zoom },
    });

    featureLayer.convert = Feature2Mesh.convert({ color, extrude });
    planarlayer.attach(featureLayer);

    context.elevationLayers = [elevationlayer];
    context.colorLayers = [colorlayer];

    beforeEach('reset state', function () {
        // clear commands array
        context.scheduler.commands = [];
    });

    it('should get wmts texture with DataSourceProvider', () => {
        colorlayer.source = new WMTSSource({
            url: 'http://',
            name: 'name',
            format: 'image/png',
            tileMatrixSet: 'PM',
            projection: 'EPSG:3857',
            extent: globalExtent,
            zoom: {
                min: 0,
                max: 12,
            },
        });

        const tile = new TileMesh(geom, material, planarlayer, extent);
        material.visible = true;
        nodeLayer.level = 0;
        tile.parent = { };

        updateLayeredMaterialNodeImagery(context, colorlayer, tile, tile.parent);
        updateLayeredMaterialNodeImagery(context, colorlayer, tile, tile.parent);
        DataSourceProvider.executeCommand(context.scheduler.commands[0]).then((textures) => {
            assert.equal(textures[0].coords.zoom, zoom);
            assert.equal(textures[0].coords.row, 511);
            assert.equal(textures[0].coords.col, 512);
        });
    });

    it('should get wmts texture elevation with DataSourceProvider', (done) => {
        elevationlayer.source = new WMTSSource({
            url: 'http://',
            name: 'name',
            format: 'image/png',
            tileMatrixSet: 'PM',
            projection: 'EPSG:3857',
            zoom: {
                min: 0,
                max: 12,
            },
        });

        const tile = new TileMesh(geom, material, planarlayer, extent, zoom);
        material.visible = true;
        nodeLayerElevation.level = 0;
        tile.parent = {};

        updateLayeredMaterialNodeElevation(context, elevationlayer, tile, tile.parent);
        updateLayeredMaterialNodeElevation(context, elevationlayer, tile, tile.parent);
        DataSourceProvider.executeCommand(context.scheduler.commands[0]).then((textures) => {
            assert.equal(textures[0].coords.zoom, zoom);
            assert.equal(textures[0].coords.row, 511);
            assert.equal(textures[0].coords.col, 512);
            done();
        });
    });
    it('should get wms texture with DataSourceProvider', (done) => {
        colorlayer.source = new WMSSource({
            url: 'http://',
            name: 'name',
            format: 'image/png',
            extent: globalExtent,
            projection: 'EPSG:3857',
            zoom: {
                min: 0,
                max: 12,
            },
        });
        const tile = new TileMesh(geom, material, planarlayer, extent, zoom);
        material.visible = true;
        nodeLayer.level = 0;
        tile.parent = { };

        updateLayeredMaterialNodeImagery(context, colorlayer, tile, tile.parent);
        updateLayeredMaterialNodeImagery(context, colorlayer, tile, tile.parent);
        DataSourceProvider.executeCommand(context.scheduler.commands[0]).then((textures) => {
            const e = textures[0].coords.as(tile.extent.crs);
            assert.equal(e.zoom, zoom);
            assert.equal(e.west, tile.extent.west);
            assert.equal(e.east, tile.extent.east);
            assert.equal(e.north, tile.extent.north);
            assert.equal(e.south, tile.extent.south);
            done();
        });
    });
    it('should get 4 TileMesh from TileProvider', (done) => {
        const tile = new TileMesh(geom, material, planarlayer, extent, zoom);
        material.visible = true;
        nodeLayer.level = 0;
        tile.parent = { };

        planarlayer.subdivideNode(context, tile);
        TileProvider.executeCommand(context.scheduler.commands[0]).then((tiles) => {
            assert.equal(tiles.length, 4);
            assert.equal(tiles[0].extent.west, tile.extent.east * 0.5);
            assert.equal(tiles[0].extent.east, tile.extent.east);
            assert.equal(tiles[0].extent.north, tile.extent.north);
            assert.equal(tiles[0].extent.south, tile.extent.north * 0.5);
            done();
        });
    });
    it('should get 3 meshs with WFS source and DataSourceProvider', (done) => {
        const tile = new TileMesh(geom, material, planarlayer, extent, zoom);
        material.visible = true;
        nodeLayer.level = 0;
        tile.parent = { pendingSubdivision: false };
        featureLayer.mergeFeatures = false;
        tile.layerUpdateState = { test: new LayerUpdateState() };

        featureLayer.update(context, featureLayer, tile);
        DataSourceProvider.executeCommand(context.scheduler.commands[0]).then((features) => {
            assert.equal(features[0].children.length, 4);
            done();
        });
    });
    it('should get 1 mesh with WFS source and DataSourceProvider and mergeFeatures == true', (done) => {
        const tile = new TileMesh(
            geom,
            material,
            planarlayer,
            extent,
            zoom);
        tile.material.visible = true;
        tile.parent = { pendingSubdivision: false };
        featureLayer.source.uid = 8;
        featureLayer.mergeFeatures = true;
        featureLayer.update(context, featureLayer, tile);
        DataSourceProvider.executeCommand(context.scheduler.commands[0]).then((features) => {
            assert.ok(features[0].children[0].isMesh);
            assert.ok(features[0].children[1].isPoints);
            assert.equal(features[0].children[0].children.length, 0);
            assert.equal(features[0].children[1].children.length, 0);
            done();
        });
    });
    it('should get 1 texture with WFS source and DataSourceProvider', (done) => {
        const tile = new TileMesh(
            geom,
            material,
            planarlayer,
            extent,
            zoom);
        material.visible = true;
        tile.parent = { pendingSubdivision: false };
        nodeLayer.level = 0;
        tile.material.visible = true;
        featureLayer.source.uid = 22;
        const colorlayerWfs = new ColorLayer('color', { projection: 'EPSG:3857',
            source: featureLayer.source,
            style: {
                fill: {
                    color: 'red',
                    opacity: 0.5,
                },
                stroke: {
                    color: 'white',
                    width: 2.0,
                },
                point: {
                    color: 'white',
                    line: 'green',
                },
            },
        });
        updateLayeredMaterialNodeImagery(context, colorlayerWfs, tile, tile.parent);
        updateLayeredMaterialNodeImagery(context, colorlayerWfs, tile, tile.parent);
        DataSourceProvider.executeCommand(context.scheduler.commands[0]).then((textures) => {
            assert.equal(textures.length, 1);
            assert.ok(textures[0].isTexture);
            done();
        });
    });
});
