{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.nodePackages.npm
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
    pkgs.sqlite
    pkgs.python39
    pkgs.python39Packages.pip
    pkgs.curl
    pkgs.wget
    pkgs.git
  ];
}