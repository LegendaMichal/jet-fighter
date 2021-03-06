import React, { Component } from 'react';
import Fighter from './fighter'
import JetsData from './jetsdata'
import BasicCloud from './cloud';

const KEY = {
  DOWN: 40,
  UP: 38,
  SPACE: 32
};

export default class JetsFightGame extends Component {
  constructor(args) {
    super();
    this.state = {
      screen: {
        width: 1080,
        height: 580,
        ratio: window.devicePixelRatio || 1,
      },
      context: null,
      keys : {
        up    : 0,
        down  : 0,
        space : 0,
      },
      jetsData: []
    }
    this.canvas = React.createRef();
    this.pName = args.pName;
    this.player = null;
    this.others = [];

    this.socket = args.socket;
    this.sessionId = args.sessionId;
    this.clouds = [];
  }

  handleKeys(value, e){
    let keys = this.state.keys;
    if(e.keyCode === KEY.UP  )  keys.up     = value;
    if(e.keyCode === KEY.DOWN)  keys.down   = value;
    if(e.keyCode === KEY.SPACE) keys.space  = value;
    this.setState({
      keys : keys
    });
  }

  otherUpdate(data) {
    let found = false;
    this.others.forEach(jet => {
      if (jet.getID() === data.id) {
        jet.setPosition(data.position);
        jet.setAngle(data.angle);
        jet.updateProjectiles(data.projs);
        jet.health = data.hp;
        found = true;
        jet.destroyed = data.destroyed;
      }
    });
    if (!found) {
      this.joinOther(data);
    }
  }

  joinOther(data) {
    this.others.push(new Fighter({
      id: data.id,
      position: {
        x: this.state.screen.width/2,
        y: this.state.screen.height/2
      },
      canControl: false,
      pName: data.pName,
      health: data.health
    }));
  }

  deleteOther(data) {
    this.others = this.others.filter(jet => jet.getID() !== data.id);
  }

  updateHealth(data) {
    this.setState({
      jetsData: data
    })
  }

  componentDidMount() {
    this.socket.emit('ready', this.sessionId);
    this.socket.on('my_id', data => this.startGame(data.id));
    this.socket.on('other_update', data => this.otherUpdate(data));
    this.socket.on('player_join', data => this.joinOther(data));
    this.socket.on('player_left', data => this.deleteOther(data));
    this.socket.on('update_health', data => this.updateHealth(data));

    window.addEventListener('keyup',   this.handleKeys.bind(this, false));
    window.addEventListener('keydown', this.handleKeys.bind(this, true));

    while (this.clouds.length < 6) {
      this.clouds.push(new BasicCloud({
          screenSize: this.state.screen,
          size: {
              width: 300,
              height: 200
          }
      }));
    }

    const context = this.canvas.current.getContext('2d');
    this.setState({ context: context });
    requestAnimationFrame(() => {this.update()});
  }

  componentWillUnmount() {
    window.removeEventListener('keyup', this.handleKeys);
    window.removeEventListener('keydown', this.handleKeys);

    this.player = null;
    this.others = [];

    this.sessionId = undefined;
    this.clouds = [];
  }

  update(time) {
    const context = this.state.context;

    context.save();
    context.clearRect(0, 0, this.state.screen.width, this.state.screen.height);

    // Motion trail
    context.fillStyle = '#25c5df';
    context.globalAlpha = 0.4;
    context.fillRect(0, 0, this.state.screen.width, this.state.screen.height);
    context.globalAlpha = 1;

    // Render
    this.clouds.forEach(cloud => {
      cloud.render(context);
    });
    if (this.player !== null) {
      this.player.render(this.state);
      this.socket.emit('player_data', this.player.data());
    }
    Object.entries(this.others).forEach(([key, value]) => {
      value.render(this.state);
      if (this.player && this.player.projectiles) {
        this.player.projectiles.forEach(proj => {
          if (value.isInCollision(proj)) {
            proj.hitObject();
            this.socket.emit('enemy_hit', { id: value.id });
          }
        });
      }
    });

    context.restore();
    // Next frame
    requestAnimationFrame((time) => {this.update(time)});
  }

  startGame(id) {
    this.setState({
      inGame: true
    });

    // Make fighter
    this.player = new Fighter({
      id: id,
      position: {
        x: Math.random() * (this.state.screen.width - this.state.screen.width/4) + this.state.screen.width/8,
        y: Math.random() * (this.state.screen.height - this.state.screen.height/4) + this.state.screen.height/8,
      },
      canControl: true,
      name: this.pName,
      health: 100
    });
  }

  render() {
    return (
      <>
        <div className='container-fluid'>
          <div className='row justify-content-center'>
            <div className='col'>
              <canvas ref={this.canvas} className='game-canvas'
                width={this.state.screen.width * this.state.screen.ratio}
                height={this.state.screen.height * this.state.screen.ratio}
              />
            </div>
          </div>
        </div>
        <JetsData jetsData={this.state.jetsData}/>
      </>
    );
  }
}