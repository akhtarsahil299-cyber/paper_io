import { createGameServer } from './server';

const port = Number(process.env.PORT) || 3001;
createGameServer().listen(port).then(p => console.log(`TERRITORY.IO server listening on :${p}`));
