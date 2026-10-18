@echo off
title MC-Cube Standalone Minecraft 1.16.5
cd /d "%~dp0"
set JAVA_EXE=C:\Program Files\Eclipse Adoptium\jdk-8.0.504.1-hotspot\bin\javaw.exe
set ENV_DIR=%~dp0
set GAME_DIR=%ENV_DIR%.minecraft
set ASSETS_DIR=%ENV_DIR%assets
set NATIVES_DIR=%ENV_DIR%natives
set LIBS_DIR=%ENV_DIR%libraries

set CP=%LIBS_DIR%\org\lwjgl\lwjgl-glfw\3.2.2\lwjgl-glfw-3.2.2.jar;^
%LIBS_DIR%\org\lwjgl\lwjgl-jemalloc\3.2.2\lwjgl-jemalloc-3.2.2.jar;^
%LIBS_DIR%\org\lwjgl\lwjgl-openal\3.2.2\lwjgl-openal-3.2.2.jar;^
%LIBS_DIR%\org\lwjgl\lwjgl-opengl\3.2.2\lwjgl-opengl-3.2.2.jar;^
%LIBS_DIR%\org\lwjgl\lwjgl-stb\3.2.2\lwjgl-stb-3.2.2.jar;^
%LIBS_DIR%\org\lwjgl\lwjgl\3.2.2\lwjgl-3.2.2.jar;^
%LIBS_DIR%\org\lwjgl\lwjgl-tinyfd\3.2.2\lwjgl-tinyfd-3.2.2.jar;^
%LIBS_DIR%\com\mojang\patchy\1.3.9\patchy-1.3.9.jar;^
%LIBS_DIR%\oshi-project\oshi-core\1.1\oshi-core-1.1.jar;^
%LIBS_DIR%\net\java\dev\jna\jna\4.4.0\jna-4.4.0.jar;^
%LIBS_DIR%\net\java\dev\jna\platform\3.4.0\platform-3.4.0.jar;^
%LIBS_DIR%\com\ibm\icu\icu4j\66.1\icu4j-66.1.jar;^
%LIBS_DIR%\com\mojang\javabridge\1.0.22\javabridge-1.0.22.jar;^
%LIBS_DIR%\net\sf\jopt-simple\jopt-simple\5.0.3\jopt-simple-5.0.3.jar;^
%LIBS_DIR%\io\netty\netty-all\4.1.25.Final\netty-all-4.1.25.Final.jar;^
%LIBS_DIR%\com\google\guava\guava\21.0\guava-21.0.jar;^
%LIBS_DIR%\org\apache\commons\commons-lang3\3.5\commons-lang3-3.5.jar;^
%LIBS_DIR%\commons-io\commons-io\2.5\commons-io-2.5.jar;^
%LIBS_DIR%\commons-codec\commons-codec\1.10\commons-codec-1.10.jar;^
%LIBS_DIR%\com\mojang\brigadier\1.0.17\brigadier-1.0.17.jar;^
%LIBS_DIR%\com\mojang\datafixerupper\4.0.26\datafixerupper-4.0.26.jar;^
%LIBS_DIR%\com\google\code\gson\gson\2.8.0\gson-2.8.0.jar;^
%LIBS_DIR%\com\mojang\authlib\2.1.28\authlib-2.1.28.jar;^
%LIBS_DIR%\org\apache\commons\commons-compress\1.8.1\commons-compress-1.8.1.jar;^
%LIBS_DIR%\org\apache\httpcomponents\httpclient\4.3.3\httpclient-4.3.3.jar;^
%LIBS_DIR%\commons-logging\commons-logging\1.1.3\commons-logging-1.1.3.jar;^
%LIBS_DIR%\org\apache\httpcomponents\httpcore\4.3.2\httpcore-4.3.2.jar;^
%LIBS_DIR%\it\unimi\dsi\fastutil\8.2.1\fastutil-8.2.1.jar;^
%LIBS_DIR%\org\apache\logging\log4j\log4j-api\2.17.1\log4j-api-2.17.1.jar;^
%LIBS_DIR%\org\apache\logging\log4j\log4j-core\2.17.1\log4j-core-2.17.1.jar;^
%LIBS_DIR%\com\mojang\text2speech\1.11.3\text2speech-1.11.3.jar;^
%LIBS_DIR%\net\fabricmc\intermediary\1.16.5\intermediary-1.16.5.jar;^
%LIBS_DIR%\org\ow2\asm\asm\9.10.1\asm-9.10.1.jar;^
%LIBS_DIR%\org\ow2\asm\asm-analysis\9.10.1\asm-analysis-9.10.1.jar;^
%LIBS_DIR%\org\ow2\asm\asm-commons\9.10.1\asm-commons-9.10.1.jar;^
%LIBS_DIR%\org\ow2\asm\asm-tree\9.10.1\asm-tree-9.10.1.jar;^
%LIBS_DIR%\org\ow2\asm\asm-util\9.10.1\asm-util-9.10.1.jar;^
%LIBS_DIR%\net\fabricmc\sponge-mixin\0.17.4+mixin.0.8.7\sponge-mixin-0.17.4+mixin.0.8.7.jar;^
%LIBS_DIR%\net\fabricmc\fabric-loader\0.19.5\fabric-loader-0.19.5.jar;^
%LIBS_DIR%\com\mojang\minecraft\1.16.5\minecraft-1.16.5-client.jar

echo Starting Minecraft 1.16.5 (Fabric + Sodium + Lithium) with Java 8...
start "" "%JAVA_EXE%" -Xms512m -Xmx4096m -Duser.language=en "-Djava.library.path=%NATIVES_DIR%" -cp "%CP%" net.fabricmc.loader.launch.knot.KnotClient --version 1.16.5 --gameDir "%GAME_DIR%" --assetsDir "%ASSETS_DIR%" --assetIndex 1.16 --username AURTX --accessToken 0
